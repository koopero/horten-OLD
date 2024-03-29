// #ifdef NODE
module.exports = Connection;
var Listener = require('./Listener.js' ),
	Path = require('./Path.js');
	
var inherits = require('util').inherits;
// #endif

//inherits( Connection, Listener );

function Connection ( config ) {
	var self = this;

	config.primitive = true;
	self.keepAlive = config.keepAlive;

	Listener.call ( self, config );

	/** 
	 * Queue one or more paths to pull from the server. This will ask the server
	 * to immediately send the values of the paths. Typically, this would be used
	 * to get the server's entire state on connection. When called with no
	 * arguments, the root will be pulled. 
	 * 
	 *  This function can be called before the client has connected.
	 * 
	 * @param paths
	 */
	self.pull = function ( path )
	{
		path = Path( path ).string;

		if ( !self._pullPaths )
			self._pullPaths = [];
		
		if ( self._pullPaths.indexOf ( path ) == -1 )
			self._pullPaths.push ( path );
		
		self._pull ();
	};

	self._pull = function () 
	{
		if ( !self._pullPaths || !self._pullPaths.length )
			return;

		if ( !self.readyToSend () ) {
			return;
		}
		
		var msg = {
			get: self._pullPaths
		};

		if ( self.send ( msg ) ) {
			self._pullPaths = null;
		} 

	}


	self.push = function ( path )
	{
		path = Path ( path );

		if ( !self._pushData )
			self._pushData = {};

		self._pushData[path] = self.FILL_DATA;
		self._push();
	}

	self._push = function ()
	{
		if ( !self._pushData )
			return;

		if ( !self.readyToSend() ) {
			return;
		}

		var somethingToSend = false;
		
		for ( var remotePath in self._pushData ) {
			
			somethingToSend = true;
			
			if ( self._pushData[ remotePath ] == self.FILL_DATA ) {
				self._pushData[ remotePath ] = self.get ( remotePath );
			}
		}
		

		if ( somethingToSend ) {
			self.send ( { set: self._pushData } );
		}
		
		self._pushData = {};	
	}

	self.readyToSend = function ()
	{
		return false;
	}

	/**
	 * Called when the other end of the connection drops
	 * unexpectedly.
	 */

	self.onRemoteClose = function ()
	{	
		if ( self.keepAlive && 'function' == typeof self.reconnect ) {
			console.log ( self.name, 'Remote closed, retrying in 1 second' );

			setTimeout ( function () {
				self.reconnect ();
			}, 1000 );
		} else {
			console.log ( self.name, 'Closed by remote' );
			
			self.close();
		}
	}

	self.onData = function ( value, path )
	{
		if ( !self._pushData )
			self._pushData = {};
		
		self._pushData[path] = value;

		// Should delay push here
		self._push();
	}

	self.onRemoteData = function ( msg ) {

		if ( self.debug ) {
			console.log ( self.name, "RECV", msg );
		}

		if ( 'string' == typeof msg ) {
			try {
				msg = JSON.parse ( msg );
			} catch ( e ) {
				console.log ( self.name, 'Bad JSON from remote' );
				return;
			}
		}

				
		if ( msg.set ) {
			var set = {};
			//console.log ( 'msg.set '+JSON.stringify ( msg.set ) );
			
			for ( var remotePath in msg.set ) {
				
				var value = msg.set[remotePath];

				self.set ( value, remotePath );
			}
			
			//console.log ( "GOT MESG set", set );

		}
		
		if ( msg.get ) {
			self.push( msg.get );
		}
	}

	/** Close the connection with no hope of reopening */
	self.close = function ()
	{

		self.remove();
		self.keepAlive = false;
		
		if ( 'function' == typeof self._close ) {
			self._close();
		}
	};


	//
	//	Various things to attach.
	//

	self.attachWebSocket = function ( websocket ) {
		var self = this;
		
		websocket.onopen = function () 
		{
			console.log ( self.name, 'Open WS' );
			self._push ();
			self._pull ();
		};
		
		websocket.onerror = function ( error ) 
		{
			console.log ( self.name, "WS error " +JSON.stringify(error) );
		};
		
		websocket.onmessage = function ( msg )
		{
			self.onRemoteData ( msg.data );		
		};
		
		websocket.onclose = function ()
		{
			//console.log ( self.name, "onclose" );
			self.onRemoteClose ();
		};	

		this.readyToSend = function () {
			return websocket.readyState == 1;
		}

		this.send = function ( msg ) {
			if ( websocket.readyState != 1 ) 
				return false;


			msg = JSON.stringify ( msg );
			websocket.send ( msg );

			return true;
		}

		this._close = function () {
			websocket.close ();
		}

		if ( websocket.readyState == 1 ) {
			self._push ();
			self._pull ();
		}
	}

	self.attachSockJSClient = function ( sock, remotePath, config ) {
		self.sockJS = sock;
		remotePath = Path ( remotePath ).string;
			
		sock.onopen = function () {
			sock.send ( JSON.stringify ( {
				path: remotePath
			}))
		}

		sock.onmessage = function ( msg ) {
			try {
				msg = JSON.parse ( msg.data );
			} catch ( e ) {
				console.log ( self.name, "Bad JSON in server path response", msg );
				sock.close();
				self.onRemoteClose ()
				return;
			}

			if ( msg ) {
				self.attachWebSocket ( sock );
				self.onRemoteData ( msg );
			} else {
				console.log ( self.name, "Didn't get path handshake from server" );
				sock.close ();
				self.onRemoteClose ();
			}
		}

		sock.onclose = function () {
			console.log ( self.name, "Didn't get path handshake from server" );
			self.onRemoteClose ();
		}

		sock.onerror = function () {

		}
	}
}