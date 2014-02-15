var H = require('../index.js' ),
	assert = require('assert'),
	osc = require('node-osc');

//H().debug = true;

var port = 65321;

describe('OSC', function () {
	var 
		receive,
		listener = H.listen( "/", function( value ) { 
			receive( value );
		});


	it('should start a server', function () { 
		server = H.OSC( "osc://:"+port );
		//setTimeout( )
	});

	it('should receive a message', function ( cb ) {

		var number = Math.round( Math.random() * 1000 );

		receive = function ( value ) {
			assert.equal( value.number, number );
			cb();
		}

		var client = new osc.Client( '127.0.0.1', port );
		client.send( 'number', number );

	} );

	it('should send via a Client', function ( cb ) {
		var path = 'should/send/client',
			value = Math.round( Math.random() * 1000 );

		receive = function () {
			assert.equal( H.get( path ), value );
			cb();
		}

		var client = H.OSC.Client( port );
		client.send( value, path );
	});


});