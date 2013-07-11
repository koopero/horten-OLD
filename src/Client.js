Horten.client = Client;


var wsProtocol = 'horten-protocol';


function Client ( url, options, callback ) {
	var urlStr;

	if ( 'string' == typeof url ) {
		urlStr = url;
		url = require('url').parse( url );
	} else {
		throw new Error ( 'parameter currently un-supported');
	}


	if ( url.protocol == 'ws:' ) {
		// Web Socket
		var listener = new HortenWebSocket ()

		listener.name = urlStr;

		var client;

		if ( 'function' == typeof require && 'undefined' != typeof exports ) {
			var client;

			listener.reconnect = function () {

				client = new (require('websocket').client);

				client.on('connectFailed', function ( error ) {
					console.log ( listener.name, 'Connecting failed' );
					listener.onremoteclose ()
				});

				client.on('connect', function ( conn ) {
					console.log ( listener.name, 'Connected ' );
					listener.wsn = conn;

					conn.on('close', function () {
						listener.onremoteclose ();
					});

					conn.on('message', function ( message ) {
						if ( message.type != 'utf8' ) {
							console.log ( listener.name, 'Not UTF8 from remote' );
							return;
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

			


		} else if ( 'function' == typeof WebSocket ) {
			listener.reconnect = function () {
				console.log ( "WebSocket connecting to", url );
				client = new WebSocket ( url, wsProtocol );
				listener.attachWebSocket ( client );
			}

		} else if ( 'function' == typeof WebSocketClient ) {
			

		} else {
			throw new Error ( 'No WebSocket library' );
		}

		listener.primitive = true;
		
		listener.keepAlive = true;

		listener.pull ();

		listener.reconnect();
		listener.attach();

		

	}
}
