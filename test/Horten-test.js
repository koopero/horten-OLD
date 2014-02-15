var H = require('../index.js' );
var should = require('should');

describe ( 'Horten', function () {

	describe ( '#instance()', function () {
		it('should have a global instance', function () {
			var instance = H.instance();
			instance.should.equal ( H.instance() );

			H.set ( { global: 'instance' } );
			instance.get('global').should.equal('instance');

			var another = new H();
			another.should.not.equal( instance ); 

		});
	});

	describe ( '#walk()', function () {
		var testOb = {
			'path': {
				'one': 1,
				'two': 2
			},
			'three': 3
		}
		it ('should walk an object', function () {
			H.walk ( testOb ).should.eql ( testOb );
			H.walk ( testOb, 'path/one' ).should.eql ( 1 );
			should.strictEqual ( H.walk ( testOb, 'four' ), undefined );
			H.walk ( testOb, 'path', true ).should.equal ( testOb['path'] );
		});
	});

	describe ( '#set()', function () {

		it('will do a simple set and get', function () {
			var h = new H ();
			h.set({ 'foo': 'bar'} );
			h.get().should.eql ( { 'foo': 'bar'} );
		});

		it('will do a simple set and get on a path', function () {
			var h = new H ();
			h.set( 'hello', 'foo/bar' );
			h.get().should.eql ( { foo: { bar: 'hello'} } );
			h.get('/foo/bar/').should.eql ( 'hello' );
		});

		it('will merge objects together by default', function () {
			var h = new H ();
			h.set( { 'foo': 1 } );
			h.set( { 'bar': 2 } );
			h.get().should.eql ( { foo: 1, bar: 2 } );
			h.set( 3, 'baz' );
			h.get().should.eql ( { foo: 1, bar: 2, baz: 3 } );
			h.set( { one: 1 }, 'buzz/bark' );
			h.set( { two: 2 }, 'buzz/bark' );
			h.get('buzz').should.eql ( { bark: { one: 1, two: 2 } } );
		})

		it('will return whether the path has changed or not', function () {
			var h = new H ();
			h.set ( 4, 'foo/bar' ).should.equal( true );
			h.set ( 4, 'foo/bar' ).should.equal( false );
			h.set ( { bar: 4 }, 'foo').should.equal( false );
			h.set ( { bar: 5 }, 'foo').should.equal( true );
		});

		it('makes proper use of the "keepTopology" flag', function () {
			var h = new H ();
			h.set ( { four: 4, foo: { five: 5, six: 6 } } );
			h.set ( 7, 'seven', H.setFlags.keepTopology ).should.eql ( false );
			h.get().should.eql( { four: 4, foo: { five: 5, six: 6 } } );
			h.set ( 7, 'foo/seven', H.setFlags.keepTopology ).should.eql ( false );
			h.set ( 'hex', 'foo/six', H.setFlags.keepTopology ).should.eql ( true );
			h.get().should.eql( { four: 4, foo: { five: 5, six: 'hex' } } )
		} );

		it('makes proper use of the "replace" flag', function () {
			var h = new H ();
			h.set ( { 'really': 'old' } );
			h.set ( { 'brand': 'new' }, null, H.setFlags.replace );
			h.get().should.eql( { 'brand': 'new' } );

			h.set ( { 'spanking': 'new' }, 'brand', H.setFlags.replace );
			h.get().should.eql( { 'brand': { spanking: 'new' } } );

			h.set ( { 'even': 'newer' }, 'brand', H.setFlags.replace );
			h.set ( 4, 'four', null, H.setFlags.replace );
			
			h.get().should.eql( { 'brand': { even: 'newer' }, four: 4} );

		} );

		it('should not allow setting of root to primitive', function () {
			var h = new H();
			h.set ( { one: 1 } )
			h.set ( 2 ).should.equal ( false );
			h.get().should.eql ( { one: 1 } );
		})
	})

	describe( '#get()', function () {
		it('should return a copy of data', function () {
			var h = new H();
			h.set ( 'bar', 'foo' );
			
			var r = h.get();

			r.should.eql ( h.get() );
			r.should.not.equal ( h.get() );
		});

		it('should return original data with "original" parameter', function () {
			var h = new H();

			h.set ( 'bar', 'longer/path/this/time' );
			h.get ( 'longer', true ).should.equal ( h.get ( 'longer', true ) );
			
			// DON'T DO THIS IN YOUR REAL CODE!!! SERIOUSLY!
			h.get ( 'longer/path/this', true ).time = 'foo';
			h.get ( 'longer/path/this/time' ).should.equal ( 'foo' );
		});
	});

	describe( '.flatten()', function () {
		it ('should flatten objects', function () {
			H.flatten ( { 'foo': 'Foo', 'bar': { 'baz': 'Baz' } } ).should.eql ( { '/foo/': 'Foo', '/bar/baz/' : 'Baz' } );
			H.flatten ( 'foo' ).should.eql ( { '/' : 'foo' } );
			H.flatten ( { one: 1, two: 2 }, 'path/' ).should.eql ( { '/path/one/': 1, '/path/two/': 2 } );
		});
	});

	describe( '.merge()', function () {
		it ('should do simple merging', function () {
			var ob = {};
			H.merge( ob, { one: 1 } ).should.eql ( { one: 1 } );
			H.merge( ob, { two: 2 } ).should.eql ( { one: 1, two: 2 } );
			H.merge( ob, { one: 'uno' } ).should.eql ( { one: 'uno', two: 2 } );
		});

		it ('should merge with paths', function () {
			var ob = {};
			H.merge( ob, 4, '/path/to/four/' ).should.eql ( { path: { to: { four: 4 } } } );
			H.merge( ob, 'Path', 'path' ).should.eql ( { path:'Path'} );
		})

		it('makes proper use of the "keepTopology" flag', function () {
			var ob = { four: 4, foo: { five: 5, six: 6 } };
			H.merge( ob, { seven: 7 }, null, H.setFlags.keepTopology );
			ob.should.eql ( { four: 4, foo: { five: 5, six: 6 } } );
			H.merge( ob, { four: 'quatro'} );
			ob.should.eql ( { four: 'quatro', foo: { five: 5, six: 6 } } );
			H.merge( ob, 'hex', 'foo/six', H.setFlags.keepTopology );
			ob.should.eql ( { four: 'quatro', foo: { five: 5, six: 'hex' } } );
			H.merge( ob, 7, 'foo/seven', H.setFlags.keepTopology );
			ob.should.eql ( { four: 'quatro', foo: { five: 5, six: 'hex' } } );
		} );

		it('makes proper use of the "replace" flag', function () {
			var ob = { one: 1 }
			H.merge ( ob, { two: 2 }, null, H.setFlags.replace ).should.equal ( ob );
			ob.should.eql ( { two: 2 } );

			ob = { one: 1, path: { is: { two: 2 } } };
			H.merge ( ob, { three: 3 }, 'path/is', H.setFlags.replace );
			ob.should.eql ( { one: 1, path: { is: { three: 3 } } } )
		})


		it ('should return original object when possible', function () {
			var orig = { one: 1, two: 2 };
			var result = H.merge ( orig, { three: 3 } );
			orig.should.equal ( result );

			orig = 4;
			result = H.merge ( orig, { one: 1 } );
			orig.should.not.equal ( result );
		});

	});

})