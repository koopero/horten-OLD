var H = require('horten');

/*
	This will create a write-only OSC client, useful for
	controlling devices. All changes will be sent to the
	device as OSC primitives. This has been tested with
	pyOSC (successfully) and Quartz Composer (unsuccessfully).
*/
var lights = new H.OSC ( {

	/*
		The Path of the 'device' you're sending.
		It's better to keep this limited, and avoid sending
		everything in H. 
	*/
	path: "lights",

	/*
		The host and port you're sending to.
	*/
	client: {
		port: 9999,
		host: '10.4.1.128'
	}	
})

/* 
	This will create a server and at least one client on the ports
	8000 incoming and 9000 outgoing, meshing up with the defaults
	in TouchOSC, one of my favourite programs.  

	OSC is a much different than connection oriented protocol like
	WebSocket. Often, it involves a lot of sending packets into the
	ether, and doesn't complain if they never find a home. 

	This makes it somewhat difficult to maintain sync between multiple
	nodes, as clients have no way of getting a push from the server.
	Still, 
*/
var touchOSC = new H.OSC ( {
	path: '/',

	/*
		This is the incoming port where we receive data.
	*/
	server: {
		port: 8000,
		host: 'localhost'
	},

	/* 
		autoClient will attempt to recognize unique clients and add them
		to a list of servers who will receive pushed data. This works by
		taking the unique ip addresses of incoming OSC data and henceforth
		pushing all changes to them on the following port:
	*/
		
	autoClient: 9000,

	/*
		treatAsArray should send certain paths as OSC arrays, rather than
		the primitives that H typically deals with. This is for compatibility
		with TouchOSC's xyPad and other devices. This feature has never
		sucessfully been used in the field, and may not work. 
	*/
	treatAsArray: [
		'/xyPad/'
	]
} );


/*
	This is a silly little way of testing an OSC server with
	TouchOSC. 

	It should make a neat little pattern on /multiFader and spin
	around /xyPad, which is harder than it sounds.

	See the file HortenTest.touchosc 
*/


var phase = 0;
var frameRate = 60;
setInterval ( spin, 1000/frameRate);

function spin ()
{
	phase += 1 / frameRate;
	var circle = [ Math.sin(phase) * 0.5 + 0.5, Math.cos(phase) * 0.5 + 0.5 ];
	H.set ( circle, 'osc/xyPad' );

	var wave = [ 0 ];
	var steps = 16;
	for ( var i = 0; i < steps; i ++ ) {

		v = Math.cos ( i / steps * 7.5 + phase ) + Math.cos ( i / steps * 11 + phase * 4.1 ) * 0.8;
		v = v / 4 + 0.5;
		wave[i+1] = v;
	}
	H.set ( wave, '/osc/multiFader');
}

