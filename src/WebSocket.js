if ( 'function' == typeof require && 'object' == typeof exports ) {
	//	Stupid check to see if we're in a node environment,
	//	as opposed to the browser.
	var WebSocket = require('websocket');
	var WebSocketClient = WebSocket.client;

	exports.jsFile = __filename;
} 

Horten.WebSocket = HortenWebSocket;
function HortenWebSocket ( config )
{
	this.primitive = config.primitive = true;
	// Magic object
	this.FILL_DATA = {};

	this.keepAlive = config && !!config.keepAlive;

	if ( config != null ) {
		Listener.call ( this, config, this.onData );
		this.catchAll = true;
		this.attach ();
	}
}

HortenWebSocket.prototype = new Listener ( null );

HortenWebSocket.connect = function ( connectOpts ) {
	if ( 'function' == typeof WebSocket && connectOpts.WebSocket ) {
		return new HortenWebSocketClient ( connectOpts.WebSocket );
	} else if ( 'function' == typeof SockJS && connectOpts.SockJS ) {
		return new HortenSockJSClient ( connectOpts.SockJS, connectOpts.path )
	} else {
		console.log( "Nothing to connect with", SockJS)
	}
}


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
HortenWebSocket.prototype.pull = function ( path )
{
	path = Horten.pathString( path );

	if ( !this._pullPaths )
		this._pullPaths = [];
	

	if ( this._pullPaths.indexOf ( path ) == -1 )
		this._pullPaths.push ( path );
	
	this._pull ();
};

HortenWebSocket.prototype._pull = function () 
{
	if ( !this._pullPaths || !this._pullPaths.length )
		return;

	if ( !this.readyToSend () ) {
		return;
	}
	
	var msg = {
		get: this._pullPaths
	};

	if ( this.send ( msg ) ) {
		this._pullPaths = null;
	} 

}




HortenWebSocket.prototype.push = function ( path )
{
	path = Path ( path );
	

	if ( !this._pushData )
		this._pushData = {};

	this._pushData[path] = this.FILL_DATA;
	this._push();
}

HortenWebSocket.prototype.readyToSend = function ()
{
	return false;
}

/**
 * Called when the other end of the connection drops
 * unexpectedly.
 */

HortenWebSocket.prototype.onremoteclose = function ()
{	
	var that = this;
	if ( this.keepAlive && 'function' == typeof this.reconnect ) {
		console.log ( that.name, 'Remote closed, retrying in 1 second' );

		setTimeout ( function () {
			that.reconnect ();
		}, 1000 );
	} else {
		console.log ( that.name, 'Closed by remote' );
		
		this.close();
	}
}

HortenWebSocket.prototype.onData = function ( path, value )
{
	if ( !this._pushData )
		this._pushData = {};
	
	this._pushData[path] = value;

	// Should delay push here
	this._push();
}

HortenWebSocket.prototype.onRemoteData = function ( msg ) {
	if ( 'string' == typeof msg ) {
		try {
			msg = JSON.parse ( msg );
		} catch ( e ) {
			console.log ( this.name, 'Bad JSON from remote' );
			return;
		}
	}

			
	if ( msg.set ) {
		var set = {};
		//console.log ( 'msg.set '+JSON.stringify ( msg.set ) );
		
		for ( var remotePath in msg.set ) {
			
			var value = msg.set[remotePath];
			var localPath = this.localToGlobalPath( remotePath );
			
			Horten.flattenObject( value, localPath, set );
		}
		
		console.log ( "GOT MESG set", set );

		this.horten.setMultiple ( set, this );
	}
	
	if ( msg.get ) {
		this.push( msg.get );
	}
}

/** Close the connection with no hope of reopening */
HortenWebSocket.prototype.close = function ()
{
	this.remove();
	this.keepAlive = false;
	
	if ( 'function' == typeof this._close ) {
		this._close();
	}
};

HortenWebSocket.prototype._push = function ()
{
	if ( !this._pushData )
		return;
	
	

	if ( !this.readyToSend() ) {
		return;
	}
	
	var somethingToSend = false;
	
	for ( var remotePath in this._pushData ) {
		
		somethingToSend = true;
		
		if ( this._pushData[ remotePath ] == this.FILL_DATA ) {
			var localPath = this.localToGlobalPath ( remotePath );
			this._pushData[ remotePath ] = this.horten.get ( localPath );
		}
	}
	

	if ( somethingToSend ) {
		this.send ( { set: this._pushData } );
	}
	
	this._pushData = {};	
}

/**
 * 
 */
HortenWebSocket.prototype.attachWebSocket = function ( websocket ) {
	var that = this;
	
	websocket.onopen = function () 
	{
		console.log ( that.name, 'Open WS' );
		that._push ();
		that._pull ();
	};
	
	websocket.onerror = function ( error ) 
	{
		console.log ( that.name, "WS error " +JSON.stringify(error) );
	};
	
	websocket.onmessage = function ( msg )
	{
		//console.log ( that.name, 'onmessage', msg.data );
		that.onRemoteData ( msg.data );		
	};
	
	websocket.onclose = function ()
	{
		console.log ( that.name, "onclose" );
		that.onremoteclose ();
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
		that._push ();
		that._pull ();
	}
}

/**
 * 
 */
HortenWebSocket.prototype.attachWebSocketNodeClient = function ( client ) {
	var that = this;

	client.on('connectFailed', function ( error ) {
		console.log ( that.name, 'Connecting failed' );
		that.onremoteclose ()
	});

	client.on('connect', function ( conn ) {
		console.log ( that.name, 'Connected ' );
		that.wsn = conn;

		conn.on('close', function () {
			that.onremoteclose ();
		});

		conn.on('message', function ( message ) {
			if ( message.type != 'utf8' ) {
				console.log ( that.name, 'Not UTF8 from remote' );
				return;
			}
			that.onRemoteData ( message.utf8Data );
		});

		that._push ();
		that._pull ();
	});

	this.readyToSend = function () {
		return that.wsn && that.wsn.connected;
	}

	this.send = function ( msg ) {
		if ( !that.wsn || !that.wsn.connected )
			return false;

		that.wsn.sendUTF ( JSON.stringify ( msg ) );
		return true;
	}
}



/** 
 * Connect to a remote WebSocket server at a given url.
 * 
 * @param url
 */
function HortenWebSocketClient ( url, config ) 
{
	var that = this;
	HortenWebSocket.call( this, config );

	that.name = url;

	var client;

	if ( 'function' == typeof WebSocket ) {
		this.reconnect = function () {
			client = new WebSocket ( url, 'horten-protocol' );
			this.attachWebSocket ( client );
		}

	} else if ( 'function' == typeof WebSocketClient ) {
		this.reconnect = function () {
			client = new WebSocketClient ()
			client.connect ( url, 'horten-protocol' );
			this.attachWebSocketNodeClient ( client );
		}

	} else {
		throw new Error ( 'No WebSocket library' );
	}

	this.attach();
	this.reconnect();
	

}

HortenWebSocketClient.prototype = new HortenWebSocket ( null );

/** 
 * Connect to a remote WebSocket server at a given url.
 * 
 * @param url
 */
function HortenSockJSClient ( url, remotePath, config ) 
{
	var that = this;
	HortenWebSocket.call( this, config );

	

	remotePath = Horten.pathString ( remotePath );
	that.name = url + '/'+remotePath;

	this.reconnect = function () {
		var sock = new SockJS ( url );
		sock.onopen = function () {
			sock.send ( JSON.stringify ( {
				path: remotePath
			}))
		}

		sock.onmessage = function ( msg ) {


			try {
				msg = JSON.parse ( msg.data );
			} catch ( e ) {
				console.log ( that.name, "Bad JSON in server path response", msg );
				sock.close();
				that.onremoteclose ()
				return;
			}

			if ( msg.path == remotePath ) {
				that.attachWebSocket ( sock );
				console.log ( that.name, "Connected SockJS" );

				that.onRemoteData ( msg );
			} else {
				console.log ( that.name, "Didn't get path handshake from server" );
				sock.close ();
				that.onremoteclose ();
			}
		}

		sock.onclose = function () {
			console.log ( that.name, "Didn't get path handshake from server" );
			that.onremoteclose ();
		}
	}

	this.reconnect ();

	this.attach ( );
}

HortenSockJSClient.prototype = new HortenWebSocket ( null );
