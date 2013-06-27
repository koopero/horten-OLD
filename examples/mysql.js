var H = require('horten');

/*
	Debug everything, so we can see what's coming back from pull.
*/
H.instance().debug = true;

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
	table: 		'state',

	/*
		This will console.log every SQL command that H sends,
		which you probably don't want to do in your app,
		once it's working.
	*/
	debug: 		true
});

/* 
	This is all that is required to pull state back from the
	MySQL on boot up.
*/
state.pull ();

/*
	This will create two tables in a format that should be
	good for logging an active project. EVERY change will
	be saved as a timestamped row. The column 'number' is
	included to save numeric values natively in the database,
	rather than as json-formatted TEXT. 

	Paths are stored in a seperate table, to keep the main 
	table as lean as possible.
*/
var history = new H.MySQL ( {

	// Recording history rather than state.
	history: 	true,

	// The name of the table.
	table: 		'history',

	// Number is the only column which will give any optimization.
	columns: 	[ 'number' ],

	// The table in which to store paths.
	pathTable: 	'path',

	// Connection.
	connection: connection,
	debug: 		true
});


/*
	A stupid little tester that set the Paths /milleseconds/, 
	/date/ and /counter/ to boring, but dynamic values.
*/
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