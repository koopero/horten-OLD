var
	Argue = require('./Argue.js');

module.exports = HSS;

function HSS () {
	var self = this,
		opt = Argue( arguments, '$url', { primitive: true } );

	if ( opt.url ) {
		self.listen( opt.url );
	}
}

HSS.listen = function ( url ) {

	var server = require('net').createServer( function (socket) {
		console.log ( "Connected" );

		socket.on('end', function () {
			listener.remove();
			console.log ( "Disconnected" );
		});

		var listener = new Connection ( {
			path: options.path
		});
		listener.attach_hss ( socket );
		
		//socket.end();
	});

	server.listen( url.port );
}

/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
function attach ( socket ) 
{
	var self = this;

	self.hssSocket = socket;
	self.name = "hss:"+socket.remoteAddress;

	
	socket.on('end', function () {
		self.onRemoteClose ();
	});

	this.readyToSend = function () {
		return !!socket;
	}

	this.send = function ( msg ) {
		console.log ( self.name, 'Writing hss' );
		var content = new Buffer( JSON.stringify( msg ) );
		var header = new Buffer( 4 );
		header.writeUInt32BE( content.length, 0 );
		socket.write( Buffer.concat( [ header, content ] ) );

		return true;
	}

	this._close = function () {
		socket.destroy();
		socket = null;
	}


	this.attach ();
	console.log ( self.name, 'Accepted HSS connection' );

	this.push();
}