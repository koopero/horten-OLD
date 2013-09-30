/*
	The following example will create a simple Horten server that will 
	listen to: 

		http://localhost:3000/horten/*
		ws://localhost:3000/horten/*
		http://localhost:3000/horten/*?js ( Javascript )
		http://localhost:3000/horten/__sockJS?path=* ( Sock bloody JS )


	Everything else will be served from the directory `./client/`, which
	should be some client-side examples.
*/
var hostname = 'localhost';
var port = 3000;

var connect = require('connect')
  , http = require('http')
  ,	H = require('..');


var HServer = new (H.Server) ( {
	/* 
		You need to specify a resolvable hostname under which the server
		will live. Otherwise, clients will have no way of finding the 
		server.
	*/
	hostname: hostname,

	/* 
		You need to explicitly define which port the server will live
		under. This is required for H.Server to server client javascript
		file.
	*/
	port: port,

	/*
		The prefix under which the server should live. If you're hoping to 
		server anything other than Horten data from your server, you'll
		need this. Otherwise, the default is '/'. 	

		Since Horten prefers paths with both leading and trailing slashes,
		these will be added to your path. The leading is implicit because
		of URL specs. So in this case, H.Server will pass on anything not
		starting with /horten/, including /horten. Be wary. 
	*/
	prefix: 'horten'
});

// All this is more or less straight out of the Connect example file.
var app = connect()
  .use(connect.logger('dev'))
  .use(connect.static(__dirname + '/client'))

  // This will add the HTTP and SockJS servers to the Connect server,
  // but only under `prefix`.
  .use( HServer.Middleware() );

var server = http.createServer(app);

/*
	This, unfortunately, is required for WebSocket support. If someone
	has a better way, please let me know.
*/
HServer.listenToUpgrade( server );

server.listen(port);