/*global module:false*/

/**
 * Javascript Project Boilerplate
 * Version 0.1.0
 */
module.exports = function(grunt) {
	"use strict";
	var pkg, config;

	pkg = grunt.file.readJSON('package.json');

	config = {
		banner : [
			'/**\n',
			' * <%= pkg.name %> v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n',
			' * <%= pkg.description %>\n',
			' *\n',
			' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>\n',
			' * Licensed <%= pkg.license %>\n',
			' */\n',
		].join(''),

		sources : [
			'src/utils-node.js',
			'src/Path.js',
			'src/Horten.js',
			'src/Listener.js',
			'src/MySQL.js',
			'src/Connection.js',
			'src/Client.js',
			'src/Server.js',
			'src/OSC.js',
			'src/export.js',
		],
		clientSources : [
			'src/utils-browser.js',
			'src/intro.js',
			'src/Path.js',
			'src/Horten.js',
			'src/Listener.js',
			'src/Connection.js',
			'src/Client.js',
			'src/outro.js'
		],

		tests : [
			'test/Path-test.js',
			'test/Horten-test.js',
			'test/Listener-test.js',
			'test/MySQL-test.js',
				
		],

		pkg : pkg,
		uglifyFiles : {}
	};

	// setup dynamic filenames
	config.versioned = [config.pkg.name, config.pkg.version].join('-');
	config.dist = ['dist/', '.js'].join(config.pkg.name);
	config.uglifyFiles[['dist/', '.min.js'].join(config.versioned)] = config.dist;

	// Project configuration.
	grunt.initConfig({
		pkg : config.pkg,
		clean : {
			templated: ['lib/horten.js', 'lib/horten.min.js'],
		},
		preprocessor: {
			options: {
				root: "src",
				context: {
					DEBUG: true
				}
			},
			templates: {
				files: {
					'lib/horten.js':  'template/horten.js'
				}
			}
		},
		uglify : {
			options : { mangle : true },
			client : {
				files : {
					'lib/horten.min.js' : 'lib/horten.js'
				}
			}
		},
		simplemocha: {
			options: {
				globals: ['should','__HortenInstance'],
				timeout: 3000,
				ignoreLeaks: false,
				ui: 'bdd'
			},
			all: { src: config.tests }
		},

	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-simple-mocha');
	grunt.loadNpmTasks('grunt-preprocessor');

	// Default task.
	grunt.registerTask('default', ['clean', 'preprocessor', 'uglify', 'simplemocha' ] );


};