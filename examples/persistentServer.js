var H = require('horten');
/*
	Debug everything, so we can see what's coming back from pull.
*/
H.instance().debug = true;

var hostname = "localhost";

/* 
	Start the server.
*/
var server = new H.Server ( {

	// If you would like, you can set the server to live under a 
	// specific Path. Otherwise the default will be to share everything. 
	path: '/',

	// Your hostname must be specified.
	// You sometimes can get away with 'localhost', except if you want
	// to use HortenServer's magic ?js=true server, which is pretty fun.
	hostname: hostname,

	// Websockets are awesome.
	websocket: true,

	// Specify the port to open for http and WebSocket.

	// It's unfortune that right now, Horten doesn't play nicely with any
	// other frameworks. For now, it's best to let it run on its own port.
	port: 1337,

	// SockJS ain't pretty, but it works pretty good.
	// Unfortunately, right now it needs to be on another port.
	// If the client supports is, Horten's own Websocket class
	// will be used instead.
	sockJSPort: 1338,

	// And now we come to security. Admittedly, this is a bit of a joke
	// right now, but it might block something.
	authRequest: function ( request, callback ) {
		// request is currently passed from the http req
		// that Horten will respond to. This may change.

		// Also, in the future, you'll be able to pass
		// an H.setFlags mask. 

		// For now, this to allow.
		callback ( {} );

		// This to deny.
		// callback ( false );

		// Hopefully. 
	}
} );

/* 
	This is passed straight to the mysql library, and
	used in all the following examples.
*/
var connection = 
{
	host: 		'localhost',
	port: 		8889,
	user: 		'root',
	password: 	'root',
	database: 	'horten', 
}

/*
	This will create and maintain a single table containing
	the current state of H as well as debugging information.
*/

var state = new H.MySQL ( {
	connection: connection,

	/*
		This is all the columns H.MySQL supports.
	*/
	columns: 	[ 'origin', 'method', 'time', 'number' ], 
	
	/* 
		Must alway be specified!
	*/
	table: 		'state'
});

/* 
	This is all that is required to pull state back from the
	MySQL on boot up.
*/
state.pull ();