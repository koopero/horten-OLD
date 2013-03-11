var H = require('horten');
H.instance().debug = true;

var connection = 
{
	host: 		'localhost',
	port: 		8889,
	user: 		'root',
	password: 	'root',
	database: 	'horten', 
}



var state = new H.MySQL ( {
	connection: connection,
	columns: 	 [ 'origin', 'method', 'time', 'number' ], 
	table: 		'state',
	debug: 		true
});

var history = new H.MySQL ( {
	connection: connection,
	table: 		'history',
	pathTable: 	'path',
	history: 	true,
	debug: 		true
});


var tickerI = 0;
function ticker () {
	var date = new Date ();
	H.set( 
		{
			milliseconds: date.getTime(),
			date: date.toTimeString(),
			counter: tickerI
		}
	);
	tickerI ++;
};

setInterval ( ticker, 1000 );