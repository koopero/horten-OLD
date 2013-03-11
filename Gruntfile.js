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
			'src/Path.js',
			'src/Horten.js',
			'src/Listener.js',
			'src/MySQL.js',
			'src/WebSocket.js',
			'src/Server.js',
			'src/OSC.js',
			'src/export.js',
		],
		clientSources : [
			'src/intro.js',
			'src/Path.js',
			'src/Horten.js',
			'src/Listener.js',
			'src/WebSocket.js',
			'src/outro.js'
		],

		tests : [
			'test/Path-test.js',
			'test/Horten-test.js',
			'test/Listener-test.js'
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
			dist : ['dist/'],

		},
		concat : {
			options : {
				stripBanners : true,
				banner : config.banner
			},
			dist : {
				src : config.sources,
				dest : 'dist/horten.js'
			}, 
			client : {
				src : config.clientSources,
				dest : 'dist/horten-client.js'
			}
		},
		simplemocha: {
			options: {
				globals: ['should'],
				timeout: 3000,
				ignoreLeaks: false,
				ui: 'bdd'
			},
			all: { src: config.tests }
		},
		uglify : {
			options : { mangle : true },
			client : {
				files : {
					'dist/horten-client.min.js' : 'dist/horten-client.js'
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-simple-mocha');

	// Default task.
	grunt.registerTask('default', ['clean', 'concat', 'uglify', 'simplemocha']);


};