var osc = require ( 'node-osc' ),
	urllib = require( 'url' ),
	util = require ( 'util' );

var 
	Horten = require('./Horten.js'),
	Listener = require( './Listener.js' ),
	Path = require( './Path.js');

util.inherits( MySQL, Listener );
module.exports = MySQL;

/**
	Config

		connection 	Either a mysql connection, or something to pass to mysql.createConnection.
					Usually in a format like { host: 'local', port: 3306, etc }

		keepAlive 	Set to false to die when the connection closes, rather than
					reconnecting.

		table 		The main data table.

		pathTable   The table in which to store paths. If this is defined, two tables will
					be created rather than one. See schema.

		history

		timeOffset	

		timeQuant	



*/

function MySQL ( config ) {

	if ( 'string' == typeof config.connection ) {
		var u = urlParse( config.connection );
		var userPass = String(u.auth).split(':');
		var urlPath = u.pathname.substr(1).split('/');

		if ( urlPath.length != 2 )
			throw new Error ( 'connection url must be in form mysql://user:pass@hostname/database/table' );

		config.connection = {
			host: u.hostname,
			user: userPass[0],
			port: u.port || 3306,
			password: userPass[1],
			database: urlPath[0]
		};

		config.table = config.table || urlPath[ 1 ];
	}


	if ( config.timeOffset )
		this.timeOffset = -Date.parse ( config.timeOffset );
	else
		this.timeOffset = 0;

	if ( config.timeQuant )
		this.timeQuant = parseFloat ( config.quantizeTime );
	else
		this.timeQuant = 1000;


	this.history = !!config.history;

	// Questionable magic number
	this.pathLength = parseInt ( config.pathLength ) || 640;

	// I <3 JS :P	
	var that = this;

	this.keepAlive = undefined == config.keepAlive || !!config.keepAlive;

	this.primitive = config.primitive = true;

	// Listener base
	Listener.call( this, config, this.onData );

	this.debug = !!config.debug;

	//
	//	Apply defaults and parse connection and table parameters.
	//

	// The table which holds our paths
	this.pathTable = config.pathTable ? String ( config.pathTable ) : false;

	// The table which holds our data
	this.dataTable = String ( config.table );



	// The columns we're going to use. Includes special
	// columns such as 'time'
	if ( Array.isArray ( config.columns ) ) {
		var cols = {};
		for ( var i = 0; i < config.columns.length; i ++ ) {
			var c = config.columns[i];
			cols[c] = c;
		}
		config.columns = cols;
	}

	this.columns = config.columns && typeof config.columns == 'object' ? config.columns : {};

	// Set default, required columns
	var defaultCols = [ 'path', 'json' ];
	
	if ( this.pathTable )
		defaultCols.push ( 'pathId' );

	if ( this.history )
		defaultCols.push ( 'time' );

	for ( var col in defaultCols ) {
		col = defaultCols[col];
		if ( !this.columns[col] || 'string' != typeof this.columns[col] )
			this.columns[col] = col;
	}



	//
	//	Assemble create table commands
	//

	var create = [];

	if ( this.pathTable ) {
		create.push ( 
			'CREATE TABLE IF NOT EXISTS `'+this.pathTable+'` ('+
			'`'+this.columns['pathId']+'` int(20) NOT NULL AUTO_INCREMENT, '+
			'`'+this.columns['path']+'` varchar('+this.pathLength+') NOT NULL, '+
			'PRIMARY KEY (`'+this.columns['pathId']+'`),'+
			'UNIQUE KEY `'+this.columns['path']+'`  (`path`) '+
			') ENGINE=InnoDB;'	
		);
	}

	if ( this.dataTable ) {
		var sql = 	'CREATE TABLE IF NOT EXISTS `'+this.dataTable+'` (';

		var keyCol;
		if ( this.pathTable ) {
			keyCol = this.columns['pathId'];
			sql += 	'`'+keyCol+'` int(20) NOT NULL AUTO_INCREMENT, ';
		} else {
			keyCol = this.columns['path'];
			sql +=	'`'+keyCol+'` varchar('+this.pathLength+') NOT NULL, ';
		}

		if ( this.columns['time'] ) {
			sql +=	'`'+this.columns['time']+'` BIGINT DEFAULT NULL, ';
			sql += 	'KEY `'+this.columns['time']+'` ( `'+this.columns['time']+'` ), ';
		}

		if ( this.columns['number'] )
			sql +=	'`'+this.columns['number']+'` double DEFAULT NULL, ';

		if ( this.columns['json'] )
			sql +=	'`'+this.columns['json']+'` text, ';

		if ( this.columns.origin ) 
			sql +=	'`'+this.columns.origin+'` varchar(255), ';

		if ( this.columns.method ) 
			sql +=	'`'+this.columns.method+'` char(8), ';
		


		if ( !this.history )
			sql +=	'PRIMARY';

		sql += 	' KEY `'+keyCol+'` (`'+keyCol+'`) ';
		
		sql += ') ENGINE=InnoDB;'

		create.push ( sql );

	}

	//
	//	Initialize Connection
	//
	function connect ( connection ) {

		if ( 'object' != typeof connection ) {
			// Need something!
			throw 'Connection details not specified';
		} else if ( connection._protocol ) {
			// A flaky way of determining if the connection passed in config
			// is a real connection, as oppose to the configuration for one.
		} else {
			connection = require ( 'mysql' ).createConnection ( connection );
		}

		connection.on('error', function ( err ) {
			that.horten.log ( that.name, 'error', JSON.stringify ( err.code ) );
		});

		connection.on('close', function ( err ) {
			if ( err && that.keepAlive ) {
				console.log ( that.name, 'Reconnecting' );
				connect(connection.config);
			} else {
				that.remove();
			}
		});	

		that.connection = connection;
		
		connection.connect( function ( err ) {
			if ( !err ) {
				that.connected = true;
				that.flush();
			} else {
				// Handle bad connection here!
			}
		});
	}

	connect ( config.connection );

	var cc = this.connection.config;
	this.name = 'mysql://'+cc.host+'/'+cc.database+'.'+this.dataTable;

	
	this.query = function ( sql, callback ) {
		if ( that.debug ) {
			console.log ( that.name, sql );
		}
		that.connection.query ( sql, callback );
	}



	for ( var i = 0; i < create.length; i ++ ) {
		var sql = create[i];
		this.query ( sql, 
			function ( err, result ) {
				if ( err ) {
					that.horten.log( that.name, "Error creating table" );
					throw 'SQL Error';
				}
			}
		);
	}




	// Magic object to declare that a path is being looked up.
	this._pathLookingUp = {};

	// State variables
	this.pathIds = {};
	this._queue = [];


	this.attach ();

}

MySQL.prototype.close = function ()
{
	this.keepAlive = false;
	this.connection.end ();
}

/**
	Return an escaped mysql value ( DATETIME or number ) for a given date,
	adjusting quantization and format.
*/

MySQL.prototype.escapeDate = function ( date )
{
	date = new Date ( date );
	var timeStamp = date.getTime ();

	timeStamp -= this.timeOffset;
	timeStamp /= this.timeQuant;
	
	return parseInt ( timeStamp )
}

MySQL.prototype.pull = function ( callback, time )
{
	var sql 	 = "SELECT * FROM `"+this.dataTable+"` ";

	if ( this.pathTable )
		sql 	+= 'NATURAL JOIN `'+this.pathTable+'` ';

	if ( this.history ) {
		if ( time || 0 == time ) {
			sql += 'WHERE `'+this.columns.time+'` <= '+this.escapeDate ( time );
		} else {
			sql += 'WHERE 1 ';	
		}

		sql 	+= 'GROUP BY `'+this.columns.path+'` ';
		sql 	+= 'ORDER BY `'+this.columns.time+'` DESC ';
	} else {
		sql 	+= 'WHERE 1 ';
	}

	var that = this;

	
	this.query ( sql, 
		function ( err, result ) {
			if ( result ) {
				var set = {};
				for ( var i = result.length - 1; i >= 0; i -- ) {
					var row = result[i];
					var path = row.path;
					
					var value;
					if ( row[that.columns.json] != null ) {
						try {
							value = JSON.parse ( row[that.columns.json] );
						} catch ( e ) {
							console.log ( that.name, 'ignoring bad JSON on pull' );
							continue;
						}
					} else if ( that.columns.number && row[that.columns.number] != null ) {
						value = parseFloat ( row[that.columns.number] );
					} else {
						// We don't know what to do with the row we've
						// been given.
						continue;
					}
					
					Horten.merge ( set, value, path ) ;
				}

				that.set ( set, that.prefix );
				
				if ( callback )
					callback ();
			}
			
			//console.log ( "err="+JSON.stringify(err)+" result="+JSON.stringify(result) );
		} 
	);
}

/** 
 * Translates a path into an appropriate format for our database table. If the table is configured to
 * use a string path, this is as easy as returning the path. However, if we want to use a numeric path_id
 * to save space, it's a bit more complicated. A cache of string paths to numeric path_ids is kept in
 * the variable pathIds. If getPathId finds a value here, it will return it. Otherwise, it will start a
 * query to fetch the value from the database and return null.
 * 
 * @param path
 * @returns 
 */
MySQL.prototype.getPathId = function ( path )
{
	path = Path ( path );

	// If there's no table for paths,
	// we've got nothing to do.
	if ( !this.pathTable )
		return path.toString();

	if ( this.pathIds[path] === this._pathLookingUp )
		return null;	
	
	if ( this.pathIds[path] )
		return this.pathIds[path];
	

	
	this.pathIds[path] = this._pathLookingUp;
	
	var sql = 	'SELECT `'+this.columns['pathId']+'` FROM `'+this.pathTable+'` '+
				' WHERE `'+this.columns['path']+'`='+this.connection.escape ( path.string );

	var that = this;
	
	this.query ( sql,
		function ( err, result ) {
			if ( result && result[0] && result[0][that.columns['pathId']]) {
				that.pathIds[path] = parseInt( result[0][that.columns['pathId']] );
				that.flush();
			} else {
				// Insert
				var sql = "INSERT INTO "+that.pathTable+
				' ( `'+that.columns['path']+'` ) VALUES ( '+that.connection.escape ( path.string )+")";

				that.query ( sql,
					function ( err, result ) {
						if ( result && result.insertId ) {
							that.pathIds[path] = result.insertId;
						}
						
						that.flush ();
					} 
				);
			}	
		} 
	);
	
	return null;
}


MySQL.prototype.onData = function ( value, path, method, origin )
{
	//console.log ( "MYSQL ONDATA", value, path, method, origin );

	var time = this.escapeDate( new Date () );
	
	var out = [ path, value, time, method, origin ];
	this._queue.push( out );
	
	this.flush ();
}

MySQL.prototype.flush = function ( callback )
{
	var that = this;

	if ( this._queue.length == 0 ) {
		if ( this._flushCallbacks && this._flushCallbacks.length ) {
			this._flushCallbacks.forEach ( function ( cb ) {
				cb();
			});
			this._flushCallbacks = [];
		}

		if ( 'function' == typeof callback ) {
			process.nextTick ( function() {
				callback ();
			} );
		}

		return;
	} else if ( 'function' == typeof callback ) {
		if ( !this._flushCallbacks )
			this._flushCallbacks = [];

		this._flushCallbacks.push ( callback );
	}

	if ( !that.connected ) {
		return;
	}

	var c = this.columns;
	var e = function ( v ) { 
		that.connection.escape ( v );
	};

	var sentQueries = 0;

	for ( var i = 0; i < this._queue.length; i ++ ) {

		var out = this._queue[i];
		var path 	= out[0];

		var pathId = this.getPathId ( path );
	
		if ( pathId ) {
			this._queue.splice ( i, 1 );
			i --;

			var value 	= out[1];
			var time 	= out[2];
			var method 	= out[3];
			var origin  = out[4];	

			var sql;

			if ( method == 'delete' && !this.history ) {
				var pathLike = '`'+c.path+'` LIKE '+that.connection.escape (path+'%');

				sql 	 = 'DELETE FROM ';
				sql 	+= ' `'+this.dataTable+'` WHERE ';

				if ( this.pathTable ) {
					sql += ' `'+c.pathId+'` IN ';
					sql += ' ( SELECT `'+c.pathId+'` FROM `'+this.pathTable+'` WHERE ';
					sql += pathLike;
					sql += ' )'
				} else {
					sql += pathLike;
				}

			} else {
				var set		= {};
				var type 	= typeof value;

				sql = this.history ? 'INSERT' : 'REPLACE';
				sql += ' `'+this.dataTable+'` SET '; 

				set[ c.pathId || c.path ] = pathId;
				
				if ( c.time  )
					set[c.time] = time;
				
				if ( 'object' == typeof origin )
					origin = origin.name;

				if ( origin && c.origin ) 
					set[c.origin] = origin;
				
				if ( method && c.method ) 
					set[c.method] = method;


				if ( type == 'number' && this.columns.number ) {
					set[c.number] = value;
				} else if ( this.columns.json ) {
					set[c.json] = JSON.stringify ( value );
				} else {
					// We've got no columns that hold data, so nothing to write.
					continue;
				}
				sql 	+= that.connection.escape( set );
			}
			
			this.query ( sql, countCallbacks );
			sentQueries ++;
		} else {
			// If we're stuck retrieving pathIds, don't continue.
			// Hopefully, this will prevent things being out of
			// order, especially deletes.
			break;
		}
	}
	
	function countCallbacks ( err ) {
		if ( !err ) {
			sentQueries --;
			if ( sentQueries == 0 ) {
				that.flush();
			}
		}
	}
}
