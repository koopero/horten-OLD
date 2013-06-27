var H = require('horten');


/*
	This will create a generic Horten server that will respond to
	requests at: 

		http://example.com:1337
		ws://example.com:1337

	It will also open a seperate server for use by SockJS, living on
	port 1338. Yes, this is a silly way of doing things.

	The best way to use Horten in web based systems is to add the
	following script to your page / app / whatever:

		<script src='http://example.com:1337?js=true'></script>
	
	All data in the Horten tree will be synced bidirectionally with
	a client in the best manner possible. This starts with WebSocket,
	then falls back to SockJS. 

	As well, the server will respond in a minimally RESTful way to all
	http requests. For example:

		curl example.com:1337 

	Will output JSON for all Horten data. Of course, paths work as they
	should.

		curl example.com:1337/foo/bar -D '2'

	Will set the Path '/foo/bar/' to the number 2. Any JSON data can be
	passed as POST or PUT data. If data is not able to be interpretted
	as JSON, it will be turned into a string.

	If you haven't read it already, read:

		https://github.com/koopero/horten/blob/master/README.md#warning

	All this gonna change. 

*/
var server = new H.Server ( {

	// If you would like, you can set the server to live under a 
	// specific Path. Otherwise the default will be to share everything. 
	path: '/',

	// Your hostname must be specified.
	// You sometimes can get away with 'localhost', except if you want
	// to use HortenServer's magic ?js=true server, which is pretty fun.
	hostname: 'example.com',

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

