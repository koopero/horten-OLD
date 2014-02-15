var 
	os = require('os'),
	osc = require ( 'node-osc' ),
	urllib = require( 'url' ),
	util = require ( 'util' );

var 
	Argue = require('./Argue.js'),
	Listener = require( './Listener.js' ),
	Path = require('./Path.js');

util.inherits( OSC, Listener );
module.exports = OSC;


function OSC ( url, path ) {

	var conf = Argue( arguments, {
		treatAsArray: []
	}, '$url', 'path', { 
		primitive: true,
	} );

	if ( this.constructor != OSC ) {
		return new OSC( conf );
	}

	var self = this;
	

	Listener.call ( self, conf, self.onData );
	
	//console.log ( 'OSC', conf );
	self.clients = {};
	self.autoClient = parseInt( conf.autoClient );
	self.treatAsArray = conf.treatAsArray;
	


	if ( conf.url ) {
		self.listen( conf.url );	
	}

	if ( conf.client && conf.client.host && conf.client.port ) {
		self.addClient ( conf.client.host, conf.client.port, false );
	}
	
	self.close = function () {
		self.remove()
			
		if ( self.server ) {
			self.server.close ();
			self.server = null;
		}
		
	};

	return self;
};

OSC.prototype.listen = function ( url ) {
	var self = this;

	if ( 'number' == typeof url )
		url = {	port: url };

	if ( 'object' != typeof url )
		url = parseUrl ( url );

	url.hostname = url.hostname || os.hostname();

	self.url = 'osc://'+url.hostname+':'+url.port;
	self.name = self.url;

	self.server = new osc.Server ( url.port, url.hostname );
	self.server.on ( "message", function ( decoded, rinfo ) {
		
		var path = Path( decoded[0] ),
			value = decoded.length == 2 ? decoded[1] : decoded.slice(1);


		switch ( path[0] ) {
			case '$listen':
				var clientUrl = urllib.parse( path[1], true ).query;
				clientUrl.protocol = 'osc:';
				clientUrl.hostname = rinfo.address;

				var client = self.Client( clientUrl, true );
				
				if ( clientUrl.push || clientUrl.push === '' )
					client.push();
				
			return;
		}

		self.name = "oscIn://"+rinfo.address;
		self.set ( value, path );
		self.send( value, path );

	} );
}

OSC.prototype.Client = function ( url, create ) {
	var self = this,
		name = urllib.format( url );

	if ( !self.clients[ name ] ) {
		if ( !create )
			return;

		self.clients[ name ] = new Client ( {
			url: url,
			attach: false
		});

		console.warn ( self.clients );
	}

	return self.clients[ name ];
}

OSC.prototype.addClient = function ( address, port, push ) {
	var clientName = address + ':' + port;

	if ( !this.clients )
		this.clients = {};

	if ( clientName in this.clients ) 
		return;

	this.clients[clientName] = new osc.Client ( address, port );

	this._pushOnlyToClient
}


OSC.prototype.onData = function ( value, path, method, origin ) {
	var self = this;

	if ( !self.clients )
		return;

	var pathStr = path.string;

	if ( self.treatAsArray ) {
		for ( var i = 0; i < self.treatAsArray.length; i ++ ) {
			var wildcard = self.treatAsArray[i];
			var firstPart = pathStr.substr ( 0, wildcard.length );

			if ( firstPart == wildcard ) {
				var index = parseInt ( pathStr.substr ( wildcard.length ) );
				firstPart = OSC.pathString ( firstPart );
				if ( !self._arrayValues )
					self._arrayValues = {};

				if ( !self._arrayValues[firstPart] )
					self._arrayValues[firstPart] = [];

				self._arrayValues[firstPart][index] = OSC.primitive( value );

				if ( !self._arraySend )
					self._arraySend = {};

				self._arraySend[firstPart] = true;

				process.nextTick ( function () {
					self.sendArrays ();
				});
				return;
			}
		}
	}

	self.send ( value, path );
}

OSC.prototype.send = function ( value, path, excludeClient ) {
	var self = this,
		msg = OSC.message( value, path );

	for ( var k in self.clients ) {
		var client = self.clients[k];
		if ( client == excludeClient )
			continue;	

		client.sendMsg ( msg );		
	}
}

OSC.prototype.sendArrays = function () {
	var self = this;
	if ( self._arraySend ) {
		var path;
		for ( path in self._arraySend ) {
			for ( k in self.clients ) {
				var client = self.clients[k];
				var arr = self._arrayValues[path];
				var msg = new osc.Message (	path );

				for ( var i = 0; i < arr.length; i ++ ) 
					msg.append ( arr[i] );

				client.send ( msg );		
			}			
		}
		self._arraySend = {};
	}
}

// 	------
//	Client	
//	------

util.inherits( Client, Listener );
function Client ( url, path ) {
	var opt = Argue( arguments, '$url', 'path', { primitive: true } ),
		self = this;

	if ( self.constructor != Client ) {
		return new Client( opt );
	}

	self.osc = new osc.Client ( opt.url.hostname, opt.url.port );
	Listener.call( self, opt, self.onData );

	return self;
}

Client.prototype.onData = function ( value, path ) {

}

Client.prototype.send = function ( value, path ) {
	var self = this;

	self.osc.send( OSC.message( value, path ) );
}

Client.prototype.sendMsg = function ( msg ) {
	var self = this;

	self.osc.send( msg );
} 


OSC.Client = Client;

// ------------------
// Protocol Utilities
// ------------------


OSC.pathString = function ( path ) {
	path = Path ( path ).string;
	if ( path.substr ( path.length - 1 ) == '/' )
		path = path.substr ( 0, path.length - 1 );

	return path;
}

OSC.message = function ( value, path ) {
	return new osc.Message ( 
		OSC.pathString( path ), 
		OSC.primitive ( value ) 
	);
}

OSC.primitive = function ( value ) {
	// Okay, this is seriously fucked up, and assumes
	// that whatever is on the other end of OSC only
	// really cares about number values.
	if ( value == null || value == undefined || value == false )
		value = 0;
	else if ( value === true ) 
		value = 1;
	
	return value;
}

