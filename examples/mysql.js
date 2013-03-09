var H = require('horten');
H.instance().debug = true;


var state = new H.MySQL ( {
	// The stuff that gets us a database.
	host: 		'localhost',
	port: 		8889,
	user: 		'root',
	password: 	'root',
	database: 	'horten', 
	columns: 	 [ 'number', 'origin', 'method', 'time'], 
	table: 		'state',
	debug: 		true
});

var history = new H.MySQL ( {
	host: 		'localhost',
	port: 		8889,
	user: 		'root',
	password: 	'root',
	database: 	'horten', 
	columns: 	['time','number'], 
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