var osc = require ( 'node-osc' ),
	urllib = require( 'url' ),
	util = require ( 'util' );

var 
	Argue = require('./Argue.js'),
	Listener = require( './Listener.js' );

util.inherits( OSC, Listener );
module.exports = OSC;


function OSC ( url, path ) {

	var conf = Argue( arguments, 'url', Path, { primitive: true } );
	var self = this;

	Listener.call ( self, conf, self.onData );
	
	//console.log ( 'OSC', conf );
	self.name = 'osc';
	self.autoClient = parseInt( conf.autoClient );
	self.treatAsArray = conf.treatAsArray;
	
	if ( conf.url ) {

		var listen = urllib.parse( conf.url );
		
		self.name = 'osc://:'+conf.server.port;
		console.log ( "listening to osc", conf.server.port );

		self.server = new osc.Server ( listen.port, listen.hostname );
		self.server.on ( "message", function ( decoded, rinfo ) {
			
			var path = decoded[0];

			//console.log ( 'decoded', decoded );
			var value = decoded.length == 2 ? decoded[1] : decoded.slice(1);

			if ( path ) {
				self.name = 'osc://'+rinfo.address;
				self.set ( value, path);
			}

			if ( self.autoClient ) {
				self.addClient( rinfo.address, self.autoClient, true )
			}

		} );
		
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
};




OSC.prototype.Client = function ( url ) {
	var self = this;

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

OSC.sendToClient = function ( client, value, path ) {

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
	var self = self;
	var msg = OSC.message( value, path );

	for ( var k in self.clients ) {
		var client = self.clients[k];
		if ( client == excludeClient )
			continue;	

		//console.log ( "msg "+msg.typetags+" "+value );
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

OSC.Client = function ( url, path ) {
	var opt = Argue( arguments, 'url', Path, { primitive: true } ),
		self = this;

	self.osc = new osc.Client ( address, port );
	Listener.call( self, opt, self.onData );
}

OSC.Client.prototype.onData = function ( value, path ) {

}

OSC.Client.prototype.send = function ( value, path ) {
	path = Path( self.prefix )
}

OSC.Client.prototype.sendMsg = function ( msg ) {

} 

util.inherits( OSC.Client, Listener );


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

