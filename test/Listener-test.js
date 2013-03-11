var H = require('../dist/horten.js' );
var L = H.Listener;
var l;

require('should');

/**
	Creates a call which must be called several times before
	calling done.
*/
function multiplePrimitiveCallback( expect, done ) {
	var pending = H.flatten ( expect );

	var callback = function ( value, path ) {
		path = path.string;

		if ( pending[path] === undefined ) 
			done ( new Error ( 'Unexpected path or path called multiple times.' ) );

		if ( pending[path] != value )
			done ( new Error ( 'Wrong data for path.' ) );

		delete pending[path];

		var k;
		for ( k in pending ) {
			// If pending still has keys, we're not done.
			return;
		}

		done();
	}

	return callback;
}

describe('Listener', function () {

	beforeEach ( function () {
		H.instance().set({}, null, null, H.setFlags.replace );
	});

	afterEach ( function () {
		l.remove();
	});

	it('should construct with default parameters', function () {
		var c = function () {};
		l = new L ( 'the/path' );
		l.path.should.be.an.instanceOf ( H.Path );
		l.path.string.should.equal ( '/the/path/' );

		l.prefix.should.be.an.instanceOf ( H.Path );
		l.prefix.string.should.equal ( '/' );
		
		l.horten.should.equal ( H.instance() );
	})

	it('should automatically attach to default horten instance', function () {
		var h = H.instance();
		l = new L ( '/' );

		h.meta.lo.should.include ( l );
	});
	
	it('should respond to changes in Horten data ( object mode )', function ( done ) {
		var rand = Math.random();

		l = new L ( '/test/', function ( value, path, method, origin ) {
			value.should.eql( { rand: rand } );
			path.string.should.eql ( '/' );
			method.should.eql( 'set' );
			done();
		} );

		H.set( { rand: rand }, '/test/' );
	});

	it('should respond to simple changes in Horten data ( primitive mode )', function ( done ) {
		var rand = Math.random();

		H.set ( { one: 1 }, 'test' );
		l = new L ( 'test', function ( value ) {
			value.should.eql ( { one: 1, path: { two: 2 } } );
			done();
		} );

		H.set ( 2, 'test/path/two' );
	});

	describe('push', function () {
		it ( 'should work ( object mode )', function ( done ) {
			H.set ( { one: 1, two: 2 }, 'test' )
			l = new L ( 'test', function ( value ) {
				value.should.eql( { one: 1, two: 2 } );
				done();
			} );
			l.push();
		});

		it ( 'should work ( primitive mode )', function ( done ) {
			var cb = multiplePrimitiveCallback ( { one: 1, two: 2 }, done );
			H.set ( { one: 1, two: 2 }, 'test' )
			l = new L ( { primitive: true, path: 'test'}, cb );
			l.push();
		});
	});
	
});

