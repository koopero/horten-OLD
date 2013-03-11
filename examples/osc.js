var H = require('horten');
//H.instance().debug = this;

var osc = new H.OSC ( {
	path: 'osc',
	server: {
		port: 8000,
		host: 'localhost'
	},
	autoClient: 9000,
	treatAsArray: [
		'/xyPad/'
	]
} );

var phase = 0;
var frameRate = 60;

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

//setInterval( spin, 1000/frameRate);