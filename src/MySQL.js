HortenMySQL.prototype = new Horten.Listener ( false );
HortenMySQL.prototype.contructor = HortenMySQL;

function HortenMySQL ( config ) {




	if ( config.history ) {
		if ( config.timeOffset )
			this.timeOffset = Date.parse ( config.timeOffset );
		else
			this.timeOffset = 0;

		if ( config.quantizeTime )
			this.quantizeTime = parseFloat ( config.quantizeTime );
		else
			this.quantizeTime = 1;

		this.history = true;
	} else {
		this.history = false;
	}

	// Questionable magic number
	this.pathLength = 512;

	// I <3 JS :P	
	var that = this;

	this.keepAlive = undefined == config.keepAlive || !!config.keepAlive;

	this.primitive = config.primitive = true;

	// Listener base
	Listener.call( this, config, this.onData );

	this.debug = !!config.debug;
	
	// So we don't get debugs from mysql.
	delete config.debug;


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
		

		//if ( this.columns['origin'] )
		//	sql +=	'`'+this.columns['origin']+'` varchar(255), ';


		if ( !this.history )
			sql +=	'PRIMARY';

		sql += 	' KEY `'+keyCol+'` (`'+keyCol+'`) ';
		
		sql += ') ENGINE=InnoDB;'

		create.push ( sql );

	}

	//
	//	Initialize Connection
	//

	var connection = require ( 'mysql' ).createConnection ( config );
	this.connection = connection;

	connection.on('error', function ( err ) {
		console.log ( 'Mysql Error', JSON.stringify ( err ) );
	});

	connection.on('close', function ( err ) {
		if ( err && that.keepAlive ) {
			console.log ( that.name, 'Reconnecting' );
			that.connection = require ( 'mysql' ).createConnection(connection.config);
		} else {
			that.remove();
		}
	});	

	connection.connect();
	this.query = function ( sql, callback ) {
		if ( that.debug ) {
			console.log ( that.name, sql );
		}
		that.connection.query ( sql, callback );
	}


	this.name = 'mysql://'+config.host+'/'+config.database+'.'+this.dataTable;

	for ( var i = 0; i < create.length; i ++ ) {
		var sql = create[i];
		this.query ( sql, 
			function ( err, result ) {
				if ( err ) {
					console.log ( err );
					throw new Error( 'Error running generated SQL!' );
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

HortenMySQL.prototype.close = function ()
{
	this.keepAlive = false;
	this.connection.end ();
}

/**
	Return an escaped mysql value ( DATETIME or number ) for a given date,
	adjusting quantization and format.
*/

HortenMySQL.prototype.escapeDate = function ( date )
{
	date = new Date ( date );
	var timeStamp = date.getTime ();

	if ( this.timeOffset != undefined )
		timeStamp -= this.timeOffset;

	if ( this.quantizeTime != undefined ) {
		timeStamp /= this.quantizeTime;
	} else {
		timeStamp /= 1000;
	}

	return parseInt ( timeStamp )
}

HortenMySQL.prototype.pull = function ( callback, time )
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
HortenMySQL.prototype.getPathId = function ( path )
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


HortenMySQL.prototype.onData = function ( value, path, method, origin )
{
	var time = this.escapeDate( new Date () );
	
	var out = [ path, value, time, method, origin ];
	this._queue.push( out );
	
	this.flush ();
}

HortenMySQL.prototype.flush = function ()
{
	for ( var i = 0; i < this._queue.length; i ++ ) {

		var out = this._queue[i];
		var pathId = this.getPathId ( out[0] );
	
		if ( pathId ) {
			this._queue.splice ( i, 1 );
			i --;
			
			var value 	= out[1];
			var time 	= out[2];
			var set		= [];
			var type 	= typeof value;
			var method 	= out[3];
			var origin  = out[4];

			
			var sql  = this.history ? 'INSERT' : 'REPLACE';
			sql 	+= ' `'+this.dataTable+'` SET '; 

			set.push ( 
				'`' + ( this.columns.pathId ? this.columns.pathId : this.columns.path )+'`'+
				"=" +this.connection.escape( pathId ) );
			
			if ( this.columns.time  )
				set.push ( '`'+this.columns.time+"`="+time );
			
			if ( origin && this.columns.origin ) 
				set.push ( '`'+this.columns.origin+"`="+this.connection.escape ( origin ) );

			if ( method && this.columns.method ) 
				set.push ( '`'+this.columns.method+"`="+this.connection.escape ( method ) );


			if ( type == 'number' && this.columns.number ) {
				set.push ( '`'+this.columns.number+"`="+this.connection.escape ( value ) );
			} else if ( this.columns.json ) {
				set.push ( '`'+this.columns.json+'`='+this.connection.escape ( JSON.stringify ( value ) ) );
			} else {
				// We've got no columns that hold data, so nothing to write.
				continue;
			}
			
			sql 	+= set.join(',');
			
			this.query ( sql );
		}
	}
}

Horten.MySQL = HortenMySQL;