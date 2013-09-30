function Connection ( config ) {
	config.primitive = true;

	this.keepAlive = config.keepAlive;
	
	Listener.call ( this, config );
}

Connection.prototype = new Listener( null );

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
Connection.prototype.pull = function ( path )
{
	path = Path( path ).string;

	if ( !this._pullPaths )
		this._pullPaths = [];
	
	if ( this._pullPaths.indexOf ( path ) == -1 )
		this._pullPaths.push ( path );
	
	this._pull ();
};

Connection.prototype._pull = function () 
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


Connection.prototype.push = function ( path )
{
	path = Path ( path );

	if ( !this._pushData )
		this._pushData = {};

	this._pushData[path] = this.FILL_DATA;
	this._push();
}

Connection.prototype._push = function ()
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
			this._pushData[ remotePath ] = this.get ( remotePath );
		}
	}
	

	if ( somethingToSend ) {
		this.send ( { set: this._pushData } );
	}
	
	this._pushData = {};	
}

Connection.prototype.readyToSend = function ()
{
	return false;
}

/**
 * Called when the other end of the connection drops
 * unexpectedly.
 */

Connection.prototype.onRemoteClose = function ()
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

Connection.prototype.onData = function ( value, path )
{
	if ( !this._pushData )
		this._pushData = {};
	
	this._pushData[path] = value;

	// Should delay push here
	this._push();
}

Connection.prototype.onRemoteData = function ( msg ) {

	if ( this.debug ) {
		console.log ( this.name, "RECV", msg );
	}

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

			this.set ( value, remotePath );
		}
		
		//console.log ( "GOT MESG set", set );

	}
	
	if ( msg.get ) {
		this.push( msg.get );
	}
}

/** Close the connection with no hope of reopening */
Connection.prototype.close = function ()
{
	this.remove();
	this.keepAlive = false;
	
	if ( 'function' == typeof this._close ) {
		this._close();
	}
};


//
//	Various things to attach.
//

Connection.prototype.attachWebSocket = function ( websocket ) {
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
		that.onRemoteData ( msg.data );		
	};
	
	websocket.onclose = function ()
	{
		//console.log ( that.name, "onclose" );
		that.onRemoteClose ();
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

Connection.prototype.attachSockJSClient = function ( sock, remotePath, config ) {
	that = this;
	that.sockJS = sock;
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
			console.log ( that.name, "Bad JSON in server path response", msg );
			sock.close();
			that.onRemoteClose ()
			return;
		}

		if ( msg ) {
			that.attachWebSocket ( sock );
			that.onRemoteData ( msg );
		} else {
			console.log ( that.name, "Didn't get path handshake from server" );
			sock.close ();
			that.onRemoteClose ();
		}
	}

	sock.onclose = function () {
		console.log ( that.name, "Didn't get path handshake from server" );
		that.onRemoteClose ();
	}

	sock.onerror = function () {

	}
}