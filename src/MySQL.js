var osc = require ( 'node-osc' ),
	urllib = require( 'url' ),
	util = require ( 'util' );

var 
	Argue = require('./Argue.js'),
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

	var opt = Argue( arguments, {
		connection: null,
		table: 		false,
		pathTable: 	false,
		keepAlive: 	true,
		timeOffset: 0,
		timeQuant: 	1000,
		history: 	false,
		pathLength: 640,
		debug: 		false,
		columns: 	[ 'path', 'json' ],
	}, '$url', 'path' );

	var self = this;
	self.opt = opt;

	opt.connection = opt.connection || opt.url;

	if ( self.constructor != MySQL ) {
		return new MySQL( opt );
	}

	if ( 'string' == typeof opt.connection ) {
		var u = urlParse( opt.connection );
		var userPass = String(u.auth).split(':');
		var urlPath = u.pathname.substr(1).split('/');

		if ( urlPath.length != 2 )
			throw new Error ( 'connection url must be in form mysql://user:pass@hostname/database/table' );

		opt.connection = {
			host: u.hostname,
			user: userPass[0],
			port: u.port || 3306,
			password: userPass[1],
			database: urlPath[0]
		};

		opt.table = opt.table || urlPath[ 1 ];
	}


	
	self.timeOffset = -Date.parse ( opt.timeOffset || 0 );
	self.timeQuant = parseFloat ( opt.quantizeTime ) || 1000;
	self.history = !!opt.history;
	opt.pathLength = parseInt ( opt.pathLength );



	opt.keepAlive = undefined == opt.keepAlive || !!opt.keepAlive;

	self.primitive = opt.primitive = true;

	// Listener base
	Listener.call( self, opt, self.onData );


	self.debug = !!opt.debug;

	//
	//	Apply defaults and parse connection and table parameters.
	//

	// The table which holds our paths
	self.pathTable = opt.pathTable ? String ( opt.pathTable ) : false;

	// The table which holds our data
	self.dataTable = String ( opt.table );



	// The columns we're going to use. Includes special
	// columns such as 'time'
	if ( Array.isArray ( opt.columns ) ) {
		var cols = {};
		for ( var i = 0; i < opt.columns.length; i ++ ) {
			var c = opt.columns[i];
			cols[c] = c;
		}
		opt.columns = cols;
	}

	var columns = self.columns = opt.columns && typeof opt.columns == 'object' ? opt.columns : {};

	// Set default, required columns
	var defaultCols = [ 'path', 'json' ];
	
	if ( self.pathTable )
		defaultCols.push ( 'pathId' );

	if ( self.history )
		defaultCols.push ( 'time' );

	for ( var col in defaultCols ) {
		col = defaultCols[col];
		if ( !columns[col] || 'string' != typeof columns[col] )
			columns[col] = col;
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
			self.horten.log ( self.name, 'error', JSON.stringify ( err.code ) );
		});

		connection.on('close', function ( err ) {
			if ( err && self.keepAlive ) {
				self.horten.log ( self.name, 'Reconnecting' );
				connect(connection.config);
			} else {
				self.remove();
			}
		});	

		self.connection = connection;
		
		connection.connect( function ( err ) {
			if ( !err ) {
				self.connected = true;
				self.flush();
				var cc = self.connection.config;
				self.name = 'mysql://'+cc.host+'/'+cc.database+'.'+self.dataTable;

			} else {
				// Handle bad connection here!
			}
		});
	}

	connect ( config.connection );
	self.createTables();

	// Magic object to declare that a path is being looked up.
	self._pathLookingUp = {};

	// State variables
	self.pathIds = {};
	self._queue = [];


	self.attach ();

}

MySQL.prototype.init = function ( cb ) {


}

MySQL.prototype.createTables = function ( cb ) {
	var self = this,
		opt = self.opt,
		columns = self.columns;

	//
	//	Assemble create table commands
	//

	var create = [];

	if ( self.pathTable ) {
		create.push ( escape( 
			'CREATE TABLE IF NOT EXISTS ?? ( '+
				'?? int(20) NOT NULL AUTO_INCREMENT, '+
				'?? varchar(?) NOT NULL, '+
				'PRIMARY KEY (??),'+
				'UNIQUE KEY ?? (`path`) '+
			') ENGINE=InnoDB;'
		, [ self.pathTable, columns['pathId'], columns['path'], opt.pathLength, columns['pathId'], columns['path'] ]	
/*
			'CREATE TABLE IF NOT EXISTS `'+self.pathTable+'` ('+
			'`'+self.columns['pathId']+'` int(20) NOT NULL AUTO_INCREMENT, '+
			'`'+self.columns['path']+'` varchar('+opt.pathLength+') NOT NULL, '+
			'PRIMARY KEY (`'+self.columns['pathId']+'`),'+
			'UNIQUE KEY `'+self.columns['path']+'`  (`path`) '+
			') ENGINE=InnoDB;'	
*/
		) );
	}

	if ( self.dataTable ) {
		var sql = 	'CREATE TABLE IF NOT EXISTS `'+self.dataTable+'` (';

		var keyCol;
		if ( self.pathTable ) {
			keyCol = columns['pathId'];
			sql += 	'`'+keyCol+'` int(20) NOT NULL AUTO_INCREMENT, ';
		} else {
			keyCol = columns['path'];
			sql +=	'`'+keyCol+'` varchar('+opt.pathLength+') NOT NULL, ';
		}

		if ( columns['time'] ) {
			sql +=	'`'+columns['time']+'` BIGINT DEFAULT NULL, ';
			sql += 	'KEY `'+columns['time']+'` ( `'+columns['time']+'` ), ';
		}

		if ( columns['number'] )
			sql +=	'`'+columns['number']+'` double DEFAULT NULL, ';

		if ( columns['json'] )
			sql +=	'`'+columns['json']+'` text, ';

		if ( columns.origin ) 
			sql +=	'`'+columns.origin+'` varchar(255), ';

		if ( columns.method ) 
			sql +=	'`'+columns.method+'` char(8), ';
		


		if ( !self.history )
			sql +=	'PRIMARY';

		sql += 	' KEY `'+keyCol+'` (`'+keyCol+'`) ';
		
		sql += ') ENGINE=InnoDB;'

		create.push ( sql );

	}

	for ( var i = 0; i < create.length; i ++ ) {
		var sql = create[i];
		self.query ( sql, 
			function ( err, result ) {
				if ( err ) {
					self.horten.log( self.name, "Error creating table", err );
					throw 'SQL Error';
				}
			}
		);
	}	
}


MySQL.prototype.query = function ( sql ) {
	var self = this;

	if ( self.debug ) {
		self.horten.log ( self.name, sql );
	}
	
	self.connection.query.apply( self.connection, arguments );
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
	var self = this;

	date = new Date ( date );
	var timeStamp = date.getTime ();

	timeStamp -= self.timeOffset;
	timeStamp /= self.timeQuant;
	
	return parseInt ( timeStamp )
}

MySQL.prototype.pull = function ( callback, time )
{
	var self = this;

	var sql 	 = "SELECT * FROM `"+self.dataTable+"` ";

	if ( self.pathTable )
		sql 	+= 'NATURAL JOIN `'+self.pathTable+'` ';

	if ( self.history ) {
		if ( time || 0 == time ) {
			sql += 'WHERE `'+self.columns.time+'` <= '+self.escapeDate ( time );
		} else {
			sql += 'WHERE 1 ';	
		}

		sql 	+= 'GROUP BY `'+self.columns.path+'` ';
		sql 	+= 'ORDER BY `'+self.columns.time+'` DESC ';
	} else {
		sql 	+= 'WHERE 1 ';
	}

	

	
	self.query ( sql, 
		function ( err, result ) {
			if ( result ) {
				var set = {};
				for ( var i = result.length - 1; i >= 0; i -- ) {
					var row = result[i];
					var path = row.path;
					
					var value;
					if ( row[self.columns.json] != null ) {
						try {
							value = JSON.parse ( row[self.columns.json] );
						} catch ( e ) {
							console.log ( self.name, 'ignoring bad JSON on pull' );
							continue;
						}
					} else if ( self.columns.number && row[self.columns.number] != null ) {
						value = parseFloat ( row[self.columns.number] );
					} else {
						// We don't know what to do with the row we've
						// been given.
						continue;
					}
					
					Horten.merge ( set, value, path ) ;
				}

				self.set ( set, self.prefix );
				
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
	var self = this;
	path = String( Path ( path ) );

	// If there's no table for paths,
	// we've got nothing to do.
	if ( !self.pathTable )
		return path.toString();

	if ( self.pathIds[path] === self._pathLookingUp )
		return null;	
	
	if ( self.pathIds[path] )
		return self.pathIds[path];
	

	

	self.pathIds[path] = self._pathLookingUp;
	
	var sql = escape( 
		'SELECT ?? FROM ?? WHERE ??=?', 
		[ columns['pathId'], self.pathTable, self.columns['path'], path ] 
	);

	
	self.query ( sql,
		function ( err, result ) {
			if ( result && result[0] && result[0][self.columns['pathId']]) {
				self.pathIds[path] = parseInt( result[0][self.columns['pathId']] );
				self.flush();
			} else {
				// Insert
				var sql = escape('INSERT INTO ?? ( ?? ) VALUES ( ? )', [ self.pathTable, columns['path'], path ] );
				self.query ( sql,
					function ( err, result ) {
						if ( result && result.insertId ) {
							self.pathIds[path] = result.insertId;
						}
						
						self.flush ();
					} 
				);
			}	
		} 
	);
	
	return null;
}


MySQL.prototype.onData = function ( value, path, method, origin )
{
	var self = this;
	//console.log ( "MYSQL ONDATA", value, path, method, origin );

	var time = self.escapeDate( new Date () );
	
	var out = [ path, value, time, method, origin ];
	self._queue.push( out );
	
	self.flush ();
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
					set[c.number] = isNaN( value ) ? null : value;
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
