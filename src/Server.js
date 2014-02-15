/** Create a server which will accept both http and web socket connections. */

var Http = require('http'),
	Https = require('https'),
	fs = require('fs'),
	extend = require('util')._extend,
	urllib = require('url');

var 
	Connection = require('./Connection.js'),
	Listener = require('./Listener.js'),
	Path = require('./Path.js');

module.exports = Server;

function Server ( options ) {
	var server = this;

	options = options || {};


	if ( options.url ) {
		if ( 'string' == typeof options.url )
			options.url = urllib.parse ( options.url );

		options.port = options.url.port;
		options.hostname = options.url.hostname;
		options.prefix = options.prefix || options.url.pathname;
	}



	var prefix = options.prefix || '/';

	if ( prefix.charAt(0) != '/' )
		prefix = '/'+prefix;

	if ( prefix.charAt(prefix.length-1) != '/' )
		prefix += '/';

	var horten = options.horten || instance();
	server.log = horten.log;

	options.path = Path( options.path );
	var localPath = options.path;

	server.url = {
		hostname: options.hostname || 'localhost',
		port: options.port || '',
		pathname: prefix
	};

	this.clientJSUrl = urllib.format ( extend ( { protocol: 'http', search: '?js' }, server.url ) );


	server.loadIncludes();



	var listener = new Listener ( {
		path: options.path,
		horten: options.horten
	} );

	/* Default authorization function. */
	var authorize = function ( request, callback ) {
		//server.log ( "AUTH", request.HortenPath );
		callback( true );
	}

	/* Clean up what comes back from user-supplied authorization
	callbacks. */
	function parseAuthReturn ( auth ) {
		if ( !auth ) {
			auth = {
				'deny': true,
				'setFlags': 0
			};
		}

		return auth;
	}




	function clientJS ( path, url ) {
		var urls = [];
		var options = {};
		var ret = ';';

		
		var hostAndPrefix = server.url.hostname;
		if ( server.url.port )
			hostAndPrefix += ':'+server.url.port;

		hostAndPrefix += prefix;

		path = path.translate ( localPath );
		path = path.string.substr( 1 );

		urls.push( 'ws://' + hostAndPrefix + path );
		urls.push( 'sockjs://' + hostAndPrefix + "__sockJS?path=/" + path );
		urls.push( 'http://' + hostAndPrefix + path );

		var name = 'HortenRemote',
			funcName = "__Horten"+parseInt(Math.random()*10000000);

		var js = ';';
		js += "function "+funcName+"(){\n";
		js += "\tvar client=H.Client("+JSON.stringify(urls)+","+JSON.stringify(options)+");\n";
		//js += '\tclient.pull();\n';
		//js += '\tconsole.log("CLIENT",client);';
		js += name+'=client;\n';
		js += '};\n';
		js += "if(window.attachEvent){\n\twindow.attachEvent('onload',"+funcName+");\n";
		js += "}else{\n\tif(window.onload){\n\t\tvar cur=window.onload,newonload=function(){\n\t\t\t";
		js += "cur();\n\t\t\t"+funcName+"()\n;};window.onload=newonload;";
		js += "}else{window.onload="+funcName+";};};";

		return js;
	}



	function httpResponse ( req, res, path, auth ) 
	{
		var that = this;

		//res.writeHead( "X-Poowered-By: Horten" );

		if ( auth.deny ) {
			res.writeHead ( auth.statusCode || 403, auth.statusText || 'Forbidden' );
			res.end ();
			return true;
		}

		var url = urllib.parse( req.url, true, true );
		if ( url.query.js != undefined ) {
			res.writeHead(200, {
				"Content-Type": "text/javascript"
			});
			res.write ( server.include( 'sockjs.js' ) );
			res.write ( server.include( 'horten.js' ) );
			res.end( clientJS ( path, url ) );
			return true;
		}
		

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
					return true;
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
					
					if ( path.set ( value, null, auth.setFlags, fakeListener ) ) {
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
				value = path.get ();

				var body = value == null ? 'null' : JSON.stringify ( value, null, true );

				res.writeHead(200, {
					'Content-Length': body ? body.length : 0,
					"Content-Type": "text/javascript"
				});
				res.end( body );
			break;
		}

		return true;
	}


	//
	//	Flash socket policy server
	//

	var flashPolicyServer;
	this.listenFlashPolicy = function ( domains ) {

		if ( flashPolicyServer ) {
			throw new Error ( "Flash Policy server already open" );
		}

		if ( 'string' == typeof domains ) {
			domains = [ domains ];
		} else if ( !Array.isArray ( domains ) ) {
			domains = [ options.hostname ]
		}

		if ( !server.url.port ) {
			throw new Error ( "Port not specified" );
		}

		domains = domains.map( function ( domain ) { 
			return '\t<allow-access-from domain="'+domain+'"" to-ports="'+server.url.port+'"/>\n'
		});

		var policy = '<?xml version="1.0"?>\n'
			+ '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n'+
			+ '<cross-domain-policy>\n'+
			+ domains.join('')
			+ '</cross-domain-policy>';

		try {
			flashPolicyServer = require('net').createServer( function (socket) {
				socket.write( policy );
				socket.end();
			});
			flashPolicyServer.listen(843);
		} catch ( e ) {
			throw new Error ( "Couldn't listen to port 843 ( try sudo )" );
		}
	}

	
	function localPathFromRequest ( req ) {
		var url = urllib.parse( req.url );
		var path = url.pathname;

		if ( !prefix )
			return Path(path);

		if ( path.substr( 0, prefix.length ) != prefix )
			return false;

		var ret = localPath.append ( path.substr( prefix.length ) ); 
		
		return ret;
	}

	//
	//	Internal HTTP server.
	//
	var httpServer;
	this.listenHttp = function ( onPort ) {
		if ( httpServer ) {
			throw new Error ( 'http server already open' );
		}

		httpServer = require('http').createServer();

		httpServer.on('request', function ( req, res ) {
			var path = localPathFromRequest ( req );

			if ( !path )
				return false;

			req.HortenPath = path;

			authorize( req, function ( auth ) {
				httpResponse ( req, res, path, auth );
			});
		});

		//this.listenToWebSocket( httpServer );
		this.listenToUpgrade( httpServer );

		// Figure out port.
		if ( server.url.port && onPort && onPort != server.url.port ) {
			throw new Error ( 'Mismatch between specified port and options.port' );
		}

		var port = onPort || server.url.port || ( !!options.https ? 443 : 80 );
		if ( !server.url.port )
			server.url.port = port;

		server.log ( 'http', "listen", port );
		httpServer.listen ( port );

		return httpServer;
	}

	this.listenHttps = function ( options ) {
		
	}

	var sockJS;

	function getSockJS (  )
	{
		if ( sockJS )
			return sockJS;


		var sockJSPrefix = '__sockJS';
		var server = require('sockjs').createServer({ prefix: prefix+sockJSPrefix });
		var middleware = server.middleware (  );

		sockJS = {
			server: server,
			prefix: sockJSPrefix,
			middleware: middleware
		};

		server.on('connection', function ( sockJSConn ) {
			console.log ( "Waiting for guffman", sockJSConn );
			var listener = new Connection ( {
				attach: false
			});
			listener.waitForSockJSToSendPath ( sockJSConn, function ( path ) {

				var req = {
					path: path,
					debug: true
				};

				authorize ( req, function ( auth ) {

					if ( auth.deny ) {
						sockJSConn.close();
						return;
					}

					console.log ( "Sock authorized" );
					var handshake = {
						'hello': true
					};
					sockJSConn.write( JSON.stringify ( handshake ) );

					listener.setPath( path );
					listener.attachSockJSServer ( sockJSConn );
				} );
			} );
		});

		return sockJS;
	}


	/*
		Dead code for connection with Worlize/websocket-node, which is
		nice and all, but einaros/ws is looser and more flexible.
	*/
	this.listenToWebSocket = function ( httpServer ) {
		var wsServer = new (require('websocket').server) ( {
			httpServer: httpServer
		});
		wsServer.on('request', function ( req ) {
			var path = localPathFromRequest( req.httpRequest );
			if ( !path ) {
				req.reject();
				log( 'websocket', req.origin, "Rejected ( No Path )" );
				return;
			}
			// Fill in req with all the variables it expects.
			req.HortenPath = path;

			authorize ( req, function ( auth ) {
				if ( !auth || auth.deny ) {
					req.reject()
					log( 'websocket', "Rejected", req.origin, auth );
					return;
				}

				var websocket = req.accept( );

				var connection = new Connection ( {
					path: path
				});
				connection.name = "websocket("+req.origin+")";
				connection.attach_websocket ( websocket );
				connection.log = log;
			});

		} );

		
	}

	this.listenToUpgrade = function ( httpServer, allowMultiple ) {

		var wsServer = new (require('ws').Server) ( {
			noServer: true
		});

		function abortConnection(socket, code, name) {
			try {
				var response = [
					'HTTP/1.1 ' + code + ' ' + name,
					'Content-type: text/html'
				];
				socket.write(response.concat('', '').join('\r\n'));
			}
			catch (e) { /* ignore errors - we've aborted this connection */ }
			finally {
				// ensure that an early aborted connection is shut down completely
				try { socket.destroy(); } catch (e) {}
			}
		}

		httpServer.on('upgrade', function ( req, socket, upgradeHead ) {
			path = localPathFromRequest( req );
			
			if ( !path ) { 
				// The request does not start with prefix, so is none of our 
				// business. By default, drop it. If `allowMultiple` is specified,
				// don't do anything so the next on('upgrade') can handle it.
				// Note that if nothing else is listening to `upgrade`, the
				// connection will hang, which ain't good.

				if ( allowMultiple )
					return;

				// Kill the request.
				abortConnection( socket, 404, 'Not Found' );
				return;
			}

			// Fill in req with all the variables it expects.
			req.HortenPath = path;

			authorize ( req, function ( auth ) {
				auth = parseAuthReturn( auth );

				if ( auth.deny ) {
					abortConnection( socket, auth.statusCode || 403, auth.statusText || 'Forbidden' );
					return;
				}

				wsServer.handleUpgrade( req, socket, upgradeHead, function ( wsConnection ) {
					var connection = new Connection ( {
						path: path
					});
					connection.name = "ws("+socket.remoteAddress+")";

					connection.attach_ws ( wsConnection );
				} );
			});
		});
	}




	this.middleware = function ( ) {
		getSockJS();
		var middleware = function( req, res, next ) {
			path = localPathFromRequest( req );
			
			if ( !path ) { 
				next(); 
				return;
			}

			if ( sockJS && path.startsWith ( sockJS.prefix ) ) {
				console.log("SockJS returning middleware" );
				return sockJS.middleware.apply( this, arguments );
			}

			req.HortenPath = path;

			authorize( req, function ( auth ) {
				httpResponse ( req, res, path, auth );
			});
		};

		middleware.upgrade = function ( req, res, upgradeHead )
		{
			console.log('got upgrade');
		}
		
		return middleware;
	}

	this.close = function () {
		if ( flashPolicyServer ) {
			flashPolicyServer.close();
			flashPolicyServer = null;
		}


	}

	return server;
}

Server.prototype.loadIncludes = function () { 
	var 
		self = this,
		pathlib = require('path')
		includePath = pathlib.resolve( __dirname, '../lib/' ),
		fs = require('fs'),
		includes = fs.readdirSync( includePath );

	self.includes = self.includes || {};

	console.log ( "INCLUDES", includes );

	for ( var k in includes ) {
		var filename = includes[k];
		self.includes[filename] = fs.readFileSync( 
			pathlib.join( includePath, filename ),
			'utf8' 
		);
	}
}

Server.prototype.include = function ( k ) {
	var self = this;

	return self.includes[k] || '';
}


function instance () {
	return require('./Horten.js').instance();
}


/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
Connection.prototype.attach_ws = function ( connection ) 
{
	var that = this;

	this.wsn = connection;

	//console.log ( connection );

	connection.on('message', function(message) {
		that.onRemoteData ( message );
	});
	
	connection.on('close', function () {
		that.onRemoteClose ();
	});

	this.readyToSend = function () {
		return connection;
	}

	this.send = function ( msg ) {
		if ( !connection )
			return false;

		msg = JSON.stringify ( msg );
		if ( that.debug )
			console.log ( that.name, "SEND", msg );

		connection.send ( msg );
		return true;
	}

	this._close = function () {
		connection.close ();
		connection = null;
	}


	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}



Connection.prototype.waitForSockJSToSendPath = function ( conn, callback )
{

	var that = this,
	timeOut = setTimeout ( this._close, 2000 );

	this._close = function () {
		console.log ( this.name, 'Closed SockJS before getting path' );
		conn.close ();
	}

	conn.once('data',function ( msg ) {
		console.log ( "SOCK initial", msg );
		try {
			msg = JSON.parse ( msg );
		} catch ( e ) {
			that._close();
			return;
		}

		if ( !msg.path ) {
			console.log( "Didn't get path from remote" );
			that._close();
		}

		var path = Path( msg.path );

		console.log ( "SOCK path", path );
		callback ( path );

	});
}


Connection.prototype.attachSockJSServer = function ( connection ) 
{
	var that = this;

	this.wsn = connection;

	//console.log ( connection );

	connection.on('data', function(message) {
		that.onRemoteData ( message );
	});
	
	connection.on('close', function () {
		console.log ( that.name, 'Closed incoming connection' );
		that.onRemoteClose ();
	});

	this.readyToSend = function () {
		return connection;
	}

	this.send = function ( msg ) {
		if ( !connection )
			return false;

		msg = JSON.stringify ( msg );
		if ( that.debug )
			console.log ( that.name, "SEND", msg );

		connection.write ( msg );
		return true;
	}

	this._close = function () {
		connection.close ();
		connection = null;
	}


	this.attach ();
	console.log ( that.name, 'Accepted SockJS connection' );
}




