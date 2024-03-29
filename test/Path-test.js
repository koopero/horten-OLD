var H = require('../index.js' );
require('should');
var assert = require('assert');


describe('Path', function() {

	it('should make a working path object from a string',function(){
		var P = H.Path ( 'foo/bar' );
		P.string.should.equal('/foo/bar/');
		P[0].should.eql('foo');
		P[1].should.eql('bar');
		P.length.should.eql(2);
			
	})

	it('should make a working path object from an array', function () {
		var P = H.Path( ['foo','bar'] );
		P.string.should.equal('/foo/bar/');
	});

	it('should make a working path object from arguments', function () {
		var P = H.Path( 'foo',['bar','/baz/'] );
		P.string.should.equal('/foo/bar/baz/');
	});


	it('should make a working path object from combining Paths', function () {
		var P = H.Path( 'foo', H.Path( 'bar','/baz/') );
		P.string.should.equal('/foo/bar/baz/');
	});


	it('should return a Path object unchanged', function () {
		var P = H.Path( '/baz/qux' );
		var r = H.Path( P );
		P.should.equal( r );
	})

	it('should default to "/"', function () {
		H.Path().string.should.eql('/');
		assert.equal( H.Path( null )[0], undefined );
		assert.equal( H.Path( undefined ).length, 0 );
	});

	it('should deal with stupid or irregular input', function () {
		H.Path( '//////qux/////quark/'  ).string.should.equal ( '/qux/quark/' );
		H.Path( ['/foo/', null, 2 ]  ).string.should.equal ( '/foo/2/' );
		H.Path( false ).string.should.equal ( '/false/' );
		H.Path( 0, 1, 2 ).string.should.equal ( '/0/1/2/' );
	})

	it('should deal with unicode', function () {
		H.Path( 'ɥʇɐd//uɐılɐɹʇsnɐ'  ).string.should.equal ( '/ɥʇɐd/uɐılɐɹʇsnɐ/' );
	})

	describe('#append', function () {
		it('should append a string', function () {
			var a = H.Path('one');
			var b = a.append( 'two' );
			assert.equal( '/one/two/', String(b) );
		});

		it('should append multiple strings', function () {
			var a = H.Path('one');
			var b = a.append( 'two', 'three' );
			assert.equal( '/one/two/three/', String(b) );
		});

		it('should append another path', function () {
			var a = H.Path('one','two' );
			var b = H.Path('three/four' );
			assert.equal('/one/two/three/four/', String( a.append ( b ) ) );
		});

		it('should append an array', function () {
			var a = H.Path('one','two' );
			var b = ['three',4];
			assert.equal('/one/two/three/4/', String( a.append ( b ) ) );			
		});

		it('should return self when blank arguments are given', function () {
			var a = H.Path('one');
			assert.strictEqual( a, a.append() );
			assert.strictEqual( a, a.append( null ) );
			assert.strictEqual( a, a.append( '/' ) );
		});
	});

	describe('#translate', function () {
		it('should properly translate paths', function () {
			var P = H.Path( 'hello/world' )
			P.translate( 'hello', 'goodbye' ).string.should.eql('/goodbye/world/')
			P.translate( 'hello' ).string.should.eql('/world/')
			P.translate( null, 'goodbye' ).string.should.eql('/goodbye/hello/world/')
			assert.equal( P.translate( 'goodbye' ), undefined )
		})
	})

	describe('#startsWith', function () {
		it('should return the remainder of the path or false', function () {
			var P = H.Path( 'one/two/three' );
			P.startsWith ( 'blue' ).should.equal ( false );
			P.startsWith ( 'one').string.should.equal ( '/two/three/' );
			P.startsWith ( 'one/two').string.should.equal ( '/three/' );	
			P.startsWith ( 'one/two/three').string.should.equal ( '/' );	

		})
	})

	describe('#slice', function() {
		it('should work', function () {
			var p = H.Path('one','two','three','four')
			p.slice().string.should.equal( '/one/two/three/four/' );
			p.slice( 1 ).string.should.equal( '/two/three/four/' );
			p.slice( -1 ).string.should.equal( '/four/' );
			p.slice( -2 ).string.should.equal( '/three/four/' );
			p.slice( 1,1 ).string.should.equal( '/two/' );
			p.slice( 0,-1 ).string.should.equal( '/one/two/three/' );
			p.slice( 0,-2 ).string.should.equal( '/one/two/' );
		});
	});

	describe('orthogonal functions', function () {

		describe('#set', function () {
			it('should work', function () {
				var path = H.Path( 'ortho', 'test' );
				path.set( {
					one: 1,
					two: 2
				} );
				path.set( 3, 'three' );

				assert.deepEqual( H.get( 'ortho/test' ), { one: 1, two: 2, three: 3 } );
			});

			it('should work without object context', function () {
				var path = H.Path( 'noObject', 'test' );
				var setter = path.set;
				setter( 'foobar');

				assert.equal( 'foobar', H.get('noObject/test') );
			});

			it('should work when chaining a bunch of stuff together', function () {
				var setter = H.Path( 'chain', 'one' ).append( 'two', 'three' ).set;
				setter( { six: 'seven' }, H.Path('four', 'five' ) );
				assert.deepEqual( { one: { two: { three: { four: { five: {six: 'seven'}}}}}}, H.get('chain') );
			});
		});

		describe('#get', function () {
			it('should work', function () {
				H.set( { 
					'foo': 'bar',
					'bar': 'baz'
				}, 'test/get' );
				
				var path = H.Path( 'test', 'get' );
				assert.deepEqual(
					path.get(), 
					{ 'foo': 'bar', 'bar': 'baz' }
				);

				assert.equal( 'baz', path.get('bar') );
			});

			it('should work without object context', function () {
				H.set( 'hello', 'noContext/foo' )
				var path = H.Path( 'noContext/foo' );
				var getter = path.get;
				assert.equal( 'hello', getter() );
			});
		});

		describe('#getNumber', function () {
			it('should work', function () {
				H.set( {
					'number': 5,
					'notANumber': 'foo',
					'numberInObject': { value: 6 }
				}, 'numberTest' );

				var path = H.Path('numberTest');

				assert.equal( 5, path.getNumber('number', 0 ) );
				assert.equal( 0, path.getNumber('notANumber', 0 ) );
				assert.equal( 6, path.getNumber('numberInObject', 0 ) );
			});
		});
		
	});



});
