Horten.Client = Client;


var wsProtocol = 'horten-protocol';


function Client ( url, options, callback ) {

	if ( this instanceof Client ) {
		throw new Error ( "Not a constructor" );
	}

	if ( !options )
		options = {};

	options.keepAlive = options.keepAlive !== false;
	


	var urlStr;

	if ( 'string' == typeof url ) {
		urlStr = url;
		url = urlParse( url, true );
	} else if ( Array.isArray ( url ) ) {
		var client, i;
		for ( i = 0; i < url.length && !client; i++ ) {
			//try {
				client = Client ( url[i], options, callback )
			//} catch (e) {}

			if ( client ) 
				return client;
		}

		throw new Error ( 'No compatible connect method')

	} else {
		throw new Error ( 'parameter unsupported');
	}

	console.log ( "TRYING CONNNECT", url );
	var listener;

	if ( url.protocol == 'ws:' ) {
		// Web Socket
		listener = new Connection ( options )

		listener.name = urlStr;

		var client;

		if ( 'function' == typeof require && 'undefined' != typeof exports ) {
			var client;

			listener.reconnect = function () {

				client = new (require('websocket').client);

				client.on('connectFailed', function ( error ) {
					console.log ( listener.name, 'Connecting failed' );
					listener.onRemoteClose ()
				});

				client.on('connect', function ( conn ) {
					console.log ( listener.name, 'Connected ' );
					listener.wsn = conn;

					conn.on('close', function () {
						listener.onRemoteClose ();
					});

					conn.on('message', function ( message ) {
						if ( message.type != 'utf8' ) {
							console.log ( listener.name, 'Not UTF8 from remote' );
							return false;
						}
						listener.onRemoteData ( message.utf8Data );
					});

					listener._push ();
					listener._pull ();
				});
				client.connect ( urlStr, wsProtocol );
			}

			listener.readyToSend = function () {
				return listener.wsn && listener.wsn.connected;
			}

			listener.send = function ( msg ) {
				if ( !listener.wsn || !listener.wsn.connected )
					return false;

				listener.wsn.sendUTF ( JSON.stringify ( msg ) );
				return true;
			}

			


		} else if ( 'function' == typeof WebSocket || 'object' == typeof WebSocket ) {
			listener.reconnect = function () {
				console.log ( "WebSocket connecting to", url );
				client = new WebSocket ( urlStr, wsProtocol );

				listener.attachWebSocket ( client );
			}
		} else {
			//throw new Error ( 'No WebSocket library' );
			return false;
		}

	} else
	if ( url.protocol == 'sockjs:' ) {
		if ( 'function' != typeof SockJS ) 
			return undefined;

		var sockUrl = "http://"+url.hostname;
		if ( url.port ) 
		    sockUrl += ':'+url.port;

		sockUrl += url.pathname;

		

		listener = new Connection ( options );
		listener.name = urlStr;

		listener.reconnect = function () {
			console.log ("SockJS Reconnect", sockUrl );
			var sock = new SockJS ( sockUrl );
			listener.attachSockJSClient ( sock, url.query.path );
		}
		
	}


	if ( listener && listener.reconnect ) {
		listener.pull ();
		listener.reconnect();
		listener.attach();

		return listener;
	}

	return undefined;
}


