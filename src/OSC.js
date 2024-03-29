var 
	os = require('os'),
	osc = require ( 'node-osc' ),
	urllib = require( 'url' ),
	util = require ( 'util' );

var 
	Argue = require('./Argue.js'),
	Horten = require('./Horten.js'),
	Listener = require( './Listener.js' ),
	Path = require('./Path.js');

util.inherits( OSC, Listener );
module.exports = OSC;


function OSC ( url, path ) {

	var opt = Argue( arguments, {
		treatAsArray: []
	}, '$url', 'path', { 
		primitive: true,
	} );

	if ( this.constructor != OSC ) {
		return new OSC( opt );
	}

	var self = this;
	self.opt = opt;
	self.treatAsArray = opt.treatAsArray;
	self.clients = {};
	Listener.call ( self, opt, self.onData );

	if ( opt.port ) {
		opt.url = opt.url || {};
		opt.url.port = opt.port;
	}

	if ( opt.url ) {
		self.listen( opt.url );	
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
	var self = this,
		opt = self.opt;

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
				
				//console.warn ( "CLIENT URL", clientUrl, urllib.format( clientUrl ) )

				if ( clientUrl.push || clientUrl.push === '' )
					client.push();
				
			return;
		}

		if ( opt.clientPort ) {
			var clientUrl = 'osc:'+rinfo.address+':'+opt.clientPort;
			self.Client( clientUrl, true );
		}

		self.name = "oscIn://"+rinfo.address;

		if ( String( path.slice( -1 ) ) == '/$encoder/' ) {
			value = parseFloat( value ) || 0;

			var targetPath = path.slice( 0, -1 );
			var targetValue = parseFloat( self.get( targetPath ) ) || 0;

			targetValue += value;

			self.set ( targetValue, targetPath )

		} else {
			self.set ( value, path );
			self.send( value, path );		
		}


	} );
}

OSC.prototype.Client = function ( url, create ) {
	var self = this;

	url = 'string' == typeof url ? url : urllib.format( url );
	//console.warn ( "CLIENT", url, self.clients )
	if ( !self.clients[ url ] ) {
		if ( !create )
			return;

		var client = self.clients[ url ] = new Client ( {
			url: url,
			attach: false
		});

		client.push();

		//console.warn ( self.clients );
	}

	return self.clients[ url ];
}

OSC.prototype.addClient = function ( address, port, push ) {
	var clientName = address + ':' + port;

	if ( !this.clients )
		this.clients = {};

	if ( clientName in this.clients ) 
		return;

	this.clients[clientName] = new osc.Client ( address, port );

	return client;
}


OSC.prototype.onData = function ( value, path, method, origin ) {
	var self = this;

	if ( !self.clients )
		return;

	var pathStr = String( path );


	if ( self.treatAsArray ) {
		for ( var i = 0; i < self.treatAsArray.length; i ++ ) {
			var wildcard = self.treatAsArray[i];
			var firstPart = pathStr.substr ( 0, wildcard.length );

			

			if ( firstPart == wildcard ) {
				var index = parseInt ( pathStr.substr ( wildcard.length ) );
				firstPart = OSC.pathString ( firstPart );

				console.warn( 'OSC treatAsArray', firstPart, index, value );

				if ( !self._arrayValues )
					self._arrayValues = {};

				if ( !self._arrayValues[firstPart] )
					self._arrayValues[firstPart] = [];

				self._arrayValues[firstPart][index] = OSC.primitive( value );

				if ( !self._arraySend )
					self._arraySend = {};

				self._arraySend[firstPart] = true;

				setImmediate ( function () {
					self.sendArrays ();
				});
				return;
			}
		}
	}


	self.send ( value, path );
}

OSC.prototype.send = function ( value, path, excludeClient ) {
	var self = this;

	if ( 'object' == typeof value ) {
		var flattened = Horten.flatten( value, path );
		for ( var p in flattened ) {
			self.send( flattened[p], p, excludeClient );
		}

		return;
	}

	var	clients = self.clients,
		msg = OSC.message( value, path );

	//console.warn( "OSC SEDN", msg, clients );

	for ( var k in clients ) {
		var client = clients[k];
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
			var arr = self._arrayValues[path];
			var msg = new osc.Message (	path );

			for ( var i = 0; i < arr.length; i ++ ) 
				msg.append ( arr[i] );

			for ( k in self.clients ) {
				console.log ( "OSC sendArrays", msg );
				var client = self.clients[k];
				client.sendMsg ( msg );		
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

	if ( 'string' == typeof opt.url )
		opt.url = urllib.parse( opt.url );

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

