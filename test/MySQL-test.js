/*
	To run tests on MySQL functionality, you will need to create a file
	named MySQL-connection.json in the /test directory. This file should
	contain an object with the required connection information for your
	local, development database, similar to:

	{
		"host": 		"localhost",
		"port": 		8889,
		"user": 		"root",
		"password": 	"root",
		"database": 	"horten" 
	}

	This connection will require the permission to CREATE, TRUNCATE and DROP
	tables. DO NOT store anything else in this database, as it will
	quite likely be overwritten.

	This text is meant for development, and in most cases you should be able
	to trust Horten.MySQL to just-work(tm).
*/

var fs = require('fs');
var path = require('path');
var connFile = path.join ( __dirname, 'MySQL-connection.json' );
var mysql = require('mysql');
var connectionConfig;
var rawConnection;

var listener;

if ( fs.existsSync ( connFile ) ) {
	try {
		connectionConfig = JSON.parse ( fs.readFileSync ( connFile ) );
	} catch ( e ) {
		throw new Error ( 'Error reading json from MySQL-connection.json' );
	}

	rawConnection = mysql.createConnection ( connectionConfig );
	rawConnection.connect();
}

if ( connectionConfig ) {
	var H = require('../dist/horten.js' );
	var M = H.MySQL;
	var db;

	describe ( 'MySQL', function ( done ) {

		beforeEach( function ( done ) {
			rawConnection.query ( 'DROP TABLE IF EXISTS `table`, `pathTable`', done );
		} );

		it ( 'should read and write from a fairly simple database', function ( done ) {
			db = new M ( {
				connection: connectionConfig,

				path: '/test/mysql',
				keepAlive: false,
				table: 'table'
			} );

			H.set ( {
				"num" : 1,
				"str" : 'String',
				'tree': {
					branch1: 'Make like a tree',
					branch2: 'and leaf.'
				}
			}, 'test/mysql' );

			H.set ( {
				'tree': 'cut down'
			}, 'test/mysql', H.setFlags.replace );

			H.instance().flush();
			db.remove();


			db.flush ( function () {
				H.set( {}, 'test/mysql', H.setFlags.replace );
				H.get( 'test/mysql' ).should.eql ( {} );

				H.instance().flush();

				db.pull( function () {
					H.get('test/mysql').should.eql ( {
						"num" : 1,
						"str" : 'String',
						'tree': 'cut down'
					});
					done();
				});

			});



		})
	} );
}