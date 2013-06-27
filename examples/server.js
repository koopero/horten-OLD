var H = require('horten');
H.instance().debug = this;

var server = new H.Server ( {
	hostname: 'localhost'
} );

server.close();