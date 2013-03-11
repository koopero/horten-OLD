/** Create a server which will accept both http and web socket connections. */

var WebSocketServer = require('websocket').server;
var Http = require('http');
var Https = require('https');
var fs = require('fs');

var Url = require('url');


/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
HortenWebSocketServer = function ( request, subPath, config, auth ) 
{
	var that = this;

	var connection = request.accept('horten-protocol', request.origin );

	HortenWebSocket.call ( this, config );

	this.wsn = connection;
	
	if ( subPath )
		this.path = Horten.pathString ( this.path + subPath );

	this.name = 'ws://'+connection.remoteAddress;
		
	connection.on('error', function (error) {
		console.log ( "Connection error " +JSON.stringify(error) );
	});
		
	connection.on('message', function(message) {
		if ( message.type != 'utf8' ) {
			console.log ( that.name, 'Not UTF8 from remote' );
			return;
		}
		that.onRemoteData ( message.utf8Data );
    });
	
	connection.on('close', function () {
		console.log ( that.name, 'Closed incoming connection' );
		that.close ();
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

	this._close = function () {
		connection.close ();
	}


	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}

HortenWebSocketServer.prototype = new HortenWebSocket ( null );


HortenSockJSServer = function ( conn, subPath, config, auth ) 
{
	var that = this;

	HortenWebSocket.call ( this, config );

	if ( subPath )
		this.path = Horten.pathString ( this.path + subPath );

	this.name = 'sjs://'+conn.remoteAddress;

	console.log ( that.name, "Connected initial");

	conn.on('data', function ( message ) {
		that.onRemoteData ( message );
	} )

	conn.on('close', function ( ) {
		that.onremoteclose();
	} );

	this.readyToSend = function () {
		return conn.readyState == 1;
	}

	this.send = function ( msg ) {
		if ( conn.readyState != 1 ) 
			return false;

		conn.write ( JSON.stringify ( msg ) );

		return true;
	}

	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}

HortenSockJSServer.prototype = new HortenWebSocket ( null );



Horten.Server = HortenServer;
function HortenServer ( config ) {

	var that = this;

	if ( 'string' == typeof config ) {
		config = {
			path: config
		}
	} else if ( !config ) {
		config = {};
	}

	this.config = config;

	if ( 'function' == typeof config.auth )
		this.authRequest = config.auth;

	// Create a default listener, to take care of path translations and
	// default horten
	this.listener = new Listener ( config );
	
	this.horten = this.listener.horten;
	this.listener.remove();
	console.log ( this.listener );
	

	var port = this.port = parseInt( config.port ) || 8000;

	//
	//	
	//
	var connectOpts = {};
	var hostname = config.hostname || '127.0.0.1';




	//
	//	
	//
	var createHttpServer = function ( port ) {
		var server = config.https ? Https.createServer : Http.createServer;
		// Create HTTP server
		var server = server ( function(request, response) {
			that.authRequest ( request, function ( auth ) {
				that.processHttpRequest ( request, response, auth ); 
			} );
		});

		server.listen ( port );

		return server;
	}

	that.httpServer = createHttpServer( port );

	connectOpts.http = Url.format( {
		protocol: 	'http', 
		hostname: 	hostname,
		port: 		port
	} );

	var jsFiles = [	]

	if ( config.sockJS ) {
		jsFiles.push( 'ext/sockjs-0.3.min.js' );	
		that.sockJSServer = createHttpServer( config.sockJSPort );

		that.sockJSPrefix = config.sockJSPrefix || '__sockJS';

		if ( '/' != that.sockJSPrefix.substr ( 0, 1 ) )
			that.sockJSPrefix = '/' + that.sockJSPrefix;


		var sockjs = require ( 'sockjs' ).createServer();
		sockjs.on('connection', function ( conn ) {
			var onInitalData = function ( data ) {
				try {
					data = JSON.parse ( data );
				} catch ( e ){
					console.log ( 'sjs://'+conn.remoteAddress, 'Bad JSON in path setting' );
					conn.close ( 400, 'Bad JSON in path setting' );
				}

				if ( data.path ) {
					that.authRequest ( {
						remoteAddress: conn.remoteAddress,
						headers: conn.headers,
						path: data.path
					}, 
					function ( auth ) {
						if ( !auth ) {
							console.log ( 'Rejected SockJS request' );
							conn.close ( 403, 'Not authorized' );
							return;
						}
						conn.write ( JSON.stringify ( {'path': data.path }));
						var listener = new HortenSockJSServer ( conn, data.path, that.config, auth );
					})
				} else {
					console.log ( 'sjs://'+conn.remoteAddress, "Didn't send path", data );
					conn.close ( 400, 'Must send path' );
				}
			};
			conn.once( 'data', onInitalData );
		});

		sockjs.installHandlers( that.sockJSServer, {prefix:that.sockJSPrefix});

		connectOpts.SockJS = Url.format( {
			protocol: 	'http', 
			hostname: 	hostname,
			port: 		config.sockJSPort ,
			pathname: 	that.sockJSPrefix,
		} );


	} 


	if ( config.websocket ) {

		// Add WebSocket server
		this.wsServer = new WebSocketServer({
		    httpServer: this.httpServer
		});

		// WebSocket server
		this.wsServer.on('request', function(req) {

			if ( req.requestedProtocols.indexOf ( 'horten-protocol' ) == -1 ) {
				console.log ( 'ws://'+req.remoteAddress, 'Rejected unknown websocket sub-protocol' );
				req.reject ( 406, 'Improper sub-protocol');
				return;
			}

			that.authRequest ( req.httpRequest, function ( auth ) {
				if ( !auth ) {
					console.log ( 'ws://'+req.remoteAddress, 'Rejected websocket request' );
					req.reject ();
					return;
				}
				var listener = new HortenWebSocketServer ( req, req.httpRequest.url, that.config, auth );
			} );
		});

		connectOpts.WebSocket = Url.format( {
			protocol: 	'ws', 
			slashes: 	true, 
			hostname: 	hostname,
			port: 		port,
			pathname:   '/', 
		} );
	}


	//
	//	Build magic JS
	//




	jsFiles.push( 'horten-client.min.js' );

	//console.log( Path.join( __dirname, 'ext/sockjs-0.3.min.js') );

	this.clientJSIncludes = '';

	for ( var i = 0; i < jsFiles.length; i++ ) {
		var jsFile = jsFiles[i];
		this.clientJSIncludes += fs.readFileSync( require('path').join( __dirname, jsFile ), 'utf8' );
	}

	

	this.clientJS = function ( path ) {
		path = Path ( path ).string.substr ( 1 );

		var opts = {
			path:path
		};
		for ( var k in connectOpts ) {
			var url = Url.parse ( connectOpts[k] );

			if ( k != 'SockJS' )
				url.pathname += path;

			opts[k] = Url.format( url );
		}

		var js = 	"function __hortenConnect () { "+
					"HortenRemote=HortenWebSocket.connect(" +JSON.stringify( opts )+");HortenRemote.pull();" +
					"}" +
					"if(window.attachEvent){window.attachEvent('onload', __hortenConnect );"+
					"} else { if(window.onload) { var curronload = window.onload; var newonload = function() {"+
					"curronload(); __hortenConnect(); }; window.onload = newonload;"+
    				"} else { window.onload = __hortenConnect; } }"

		return js
	}
	
}




HortenServer.prototype.authRequest = function ( request, callback ) {

	//console.log ( "AUTH", request );

	callback ( {} );
}


/** 
 * Response to an HTTP request. 
 * 
 * @param {ServerRequest} req  The http request
 * @param {ServerResponse} res The http response
 * @param {Boolean} auth Whether an actual response is authorized
 */
HortenServer.prototype.processHttpRequest = function ( req, res, auth ) 
{
	var that = this;

	if ( !auth ) {
		res.writeHead ( 403, "Not allowed" );
		res.end ();
	}

	var url  = req.url;
	url = Url.parse( url, true );

	var path = Path( url.pathname );

	if ( url.query.js != undefined && that.clientJS ) {


		res.writeHead(200, {
			"Content-Type": "text/javascript"
		});
		res.write ( that.clientJSIncludes );

		res.end( that.clientJS ( path ) );
	}
	

	path = that.listener.localToGlobalPath ( path );

	// Send horten a fake listener object so that there will
	// be something to log in Horten.
	var fakeListener = {
		name: 'http('+req.connection.remoteAddress+')'
	}
	
	var value;
	switch ( req.method ) {
		case 'POST':
			// Here is top notch security!
			if ( auth.readOnly ) {
				res.writeHead ( 403, "Write disallowed" );
				res.end ();
				return;
			}

			var json = '';
			req.setEncoding('utf8');
			req.on('data', function ( data ) {
				json += data;
			});
			req.on('end', function ( ) {
				try {
					value = JSON.parse ( json );
				} catch ( e ) {
					res.writeHead( 400, "Invalid POST JSON" );
					res.end ();
					return;
				}
				
				if ( that.horten.set ( value,  fakeListener ) ) {
					res.writeHead( 205 );
					res.end ();
				} else {
					res.writeHead( 204 );
					res.end ();
				}
			});
		break;


		case 'GET':
		default:
			value = that.horten.get ( path );
			var body = value == null ? 'null' : JSON.stringify ( value, null, true );

			res.writeHead(200, {
			  'Content-Length': body ? body.length : 0,
			  "Content-Type": "text/javascript"
			});
			res.end( body );
		break;
	}
}

HortenServer.prototype.close = function ()
{
	if ( this.httpServer ) {
		this.httpServer.close ();
	}
}




exports.server = HortenServer;