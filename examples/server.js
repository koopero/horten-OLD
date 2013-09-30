var H = require('horten');


/*
	This will create a generic Horten server that will respond to
	requests at: 

		http://example.com:1337
		ws://example.com:1337

	The best way to use Horten in web based systems is to add the
	following script to your page / app / whatever:

		<script src='http://example.com:1337?js=true'></script>
	
	All data in the Horten tree will be synced bidirectionally with
	a client in the best manner possible. This starts with WebSocket,
	then falls back to SockJS. 

	As well, the server will respond in a minimally RESTful way to all
	http requests. For example:

		curl example.com:1337 

	will output JSON for all Horten data. Of course, paths work as they
	should.

		curl example.com:1337/foo/bar -D '2'

	Will set the Path '/foo/bar/' to the number 2. Any JSON data can be
	passed as POST or PUT data. If data is not able to be interpretted
	as JSON, it will be turned into a string.

	If you haven't read it already, read:

		https://github.com/koopero/horten/blob/master/README.md#warning

*/
var HServer = new H.Server ( {

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
	port: 1337,

	// And now we come to security. Admittedly, this is a bit of a joke
	// right now, but it might block something.
	authorize: function ( request, callback ) {
		// `request` is passed from the http req
		// that Horten will respond to. `request.path` will
		// be a `Path` of the local path of the request.

		// To allow everything, call:
		callback ( true );

		// End of executable example.
		return;

		// To deny completely, use this instead:
		callback ( false );

		// You can also return a bitmask from `H.setFlags`.

		/* 
			readOnly will disallow any writing to data.
		*/
		callback ( H.setFlags.readOnly );

		/* 
			keepTopology will only allow clients to change the values of
			Horten data, disallowing any change to the topology of data.
			
			If your application has a universe of a pre-determined size,
			and all Paths have been set, use this to disallow clients from
			creating any new Paths.
		*/
		callback ( H.setFlags.keepTopology );		
	}
});



