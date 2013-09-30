var H = require('../dist/horten.js' );
require('should');
var assert = require('assert');


describe('Path', function() {

	it('should make a working path object from a string',function(){
		var P = H.Path ( 'foo/bar' );
		P.string.should.equal('/foo/bar/');
		P.array.should.eql(['foo','bar']);
	})

	it('should make a working path object from an array', function () {
		var P = H.Path( ['foo','bar'] );
		P.string.should.equal('/foo/bar/');
	});

	it('should return a Path object unchanged', function () {
		var P = H.Path( '/baz/qux' );
		var r = H.Path( P );
		P.should.equal( r );
	})

	it('should default to "/"', function () {
		H.Path().string.should.eql('/');
		H.Path( null ).array.should.eql([]);
	});

	it('should deal with stupid or irregular input', function () {
		H.Path( '//////qux/////quark/'  ).string.should.equal ( '/qux/quark/' );
		H.Path( ['/foo/', null, 2 ]  ).string.should.equal ( '/foo/2/' );
		H.Path( false ).string.should.equal ( '/false/' );
		H.Path( 0 ).string.should.equal ( '/0/' );
	})

	it('should deal with unicode', function () {
		H.Path( 'ɥʇɐd//uɐılɐɹʇsnɐ'  ).string.should.equal ( '/ɥʇɐd/uɐılɐɹʇsnɐ/' );
	})

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

});
