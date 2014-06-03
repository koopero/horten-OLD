var
	Argue = require('./Argue.js'),
	Connection = require('./Connection.js'),
	Path = require('./Path.js');


module.exports = HSS;

function HSS () {
	var opt = Argue( arguments, '$url', { primitive: true } ),
		self = this;

	if ( self.constructor != HSS ) {
		return new HSS( opt );
	}

	self.name = "hss:"+opt.url.port;

	

	if ( opt.url ) {
		self.listen( opt.url );

	}
}

HSS.prototype.listen = function ( url ) {
	var self = this;

	var server = require('net').createServer( function (socket) {

		socket.setNoDelay( true );

		var connection = new Connection ( {
			path: self.path,
			prefix: self.prefix
		});
		attach ( connection, socket );
		
		console.log ( self.name, "connected" );


		connection.push();
	});

	server.listen( url.port );
	//console.warn ( self.name, "Listening", url )
}

/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
function attach ( connection, socket ) 
{
	var self = connection;

	self.hssSocket = socket;
	self.name = "hss:"+socket.remoteAddress;

	
	socket.on('error', function () {
		self.onRemoteClose ();
	});

	socket.on('end', function () {
		self.onRemoteClose ();
	});

	self.readyToSend = function () {
		return !!socket;
	}

	self.send = function ( msg ) {
		var content = new Buffer( JSON.stringify( msg ) );
		var header = new Buffer( 4 );

		header.writeUInt32BE( content.length, 0 );
		socket.write( Buffer.concat( [ header, content ] ) );



		return true;
	}

	self._close = function () {
		if ( socket )
			socket.destroy();
		socket = null;
	}


	self.attach ();
	//console.log ( self.name, 'Accepted HSS connection' );

	self.push();
}