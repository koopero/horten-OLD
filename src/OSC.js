var osc = require ( 'node-osc' );

Horten.OSC = HortenOSC;
HortenOSC.prototype = new Listener ( null );
function HortenOSC ( config ) {
	var that = this;
	if ( config != null ) {
		this.primitive = config.primitive = true;
		Listener.call ( this, config, this.onData );
	}

	//console.log ( 'OSC', config );
	this.name = 'osc';

	this.autoClient = parseInt( config.autoClient );
	this.treatAsArray = config.treatAsArray;

	/*
	if ( config.client && config.client.host && config.client.port ) { 
		this.client = new osc.Client ( config.client.host, config.client.port );

		this.ondata = function ( path, value ) {
			
			//
			// OSC path don't have a trailing slash
			//
			if ( path.substr ( path.length - 1 ) == '/' )
				path = path.substr ( 0, path.length - 1 );
			
			//console.log ( "osc out " + path + " " + JSON.stringify ( value ) );
			var typ = typeof value
				
			// Okay, this is seriously fucked up, and assumes
			// that whatever is on the other end of OSC only
			// really cares about number values.
			if ( value == null || value == undefined || value == false )
				value = 0;
			else if ( value === true ) 
				value = 1;
			
				
			var msg = new osc.Message ( path, value );
			console.log ( 'OSC SEND', path ); 
			//console.log ( "msg "+msg.typetags+" "+value );
			that.client.send ( msg );
		}
		
	};
	*/
	

	
	if ( config.server && config.server.host && config.server.port ) { 
		this.name = 'osc://:'+config.server.port;

		this.server = new osc.Server ( config.server.port, config.server.host );
		this.server.on ( "message", function ( decoded, rinfo ) {
			
			var path = decoded[0];

			console.log ( 'decoded', decoded );
			var value = decoded.length == 2 ? decoded[1] : decoded.slice(1);



			if ( path ) {
				that.name = 'osc://'+rinfo.address;
				that.set ( value, path);
			}

			if ( that.autoClient ) {
				that.addClient( rinfo.address, that.autoClient, true )
			}

		} );
		
	}
	
	this.close = function () {
		this.remove()
			
		if ( this.server ) {
			console.log ( "OSC CLOSE" );
			this.server.close ();
			this.server = null;
		}
		
	};
};

HortenOSC.prototype.addClient = function ( address, port, push ) {
	var clientName = address + ':' + port;

	if ( !this.clients )
		this.clients = {};

	if ( clientName in this.clients ) 
		return;



	this.clients[clientName] = new osc.Client ( address, port );

	this._pushOnlyToClient
}

HortenOSC.sendToClient = function ( client, value, path ) {

}

HortenOSC.prototype.onData = function ( value, path, origin, method ) {
	if ( !this.clients )
		return;

	var that = this;
	var pathStr = path.string;
	
	for ( var i = 0; i < this.treatAsArray.length; i ++ ) {
		var wildcard = this.treatAsArray[i];
		var firstPart = pathStr.substr ( 0, wildcard.length );

		if ( firstPart == wildcard ) {
			var index = parseInt ( pathStr.substr ( wildcard.length ) );
			firstPart = HortenOSC.OSCPathString ( firstPart );
			if ( !this._arrayValues )
				this._arrayValues = {};

			if ( !this._arrayValues[firstPart] )
				this._arrayValues[firstPart] = [];

			this._arrayValues[firstPart][index] = HortenOSC.OSCPrimitiveValue( value );

			if ( !this._arraySend )
				this._arraySend = {};

			this._arraySend[firstPart] = true;

			process.nextTick ( function () {
				that.sendArrays ();
			});

			return;
		}
	}

	var k;
	for ( k in this.clients ) {
		var client = this.clients[k];
			
		var msg = new osc.Message ( 
			HortenOSC.OSCPathString( path ), 
			HortenOSC.OSCPrimitiveValue ( value ) 
		);

		//console.log ( "msg "+msg.typetags+" "+value );
		client.send ( msg );		
	}
}

HortenOSC.OSCPathString = function ( path ) {
	path = Path ( path ).string;
	if ( path.substr ( path.length - 1 ) == '/' )
		path = path.substr ( 0, path.length - 1 );

	return path;
}

HortenOSC.OSCPrimitiveValue = function ( value ) {
	// Okay, this is seriously fucked up, and assumes
	// that whatever is on the other end of OSC only
	// really cares about number values.
	if ( value == null || value == undefined || value == false )
		value = 0;
	else if ( value === true ) 
		value = 1;
	
	return value;
}

HortenOSC.prototype.sendArrays = function () {
	if ( this._arraySend ) {
		var path;
		for ( path in this._arraySend ) {
			for ( k in this.clients ) {
				var client = this.clients[k];
				var arr = this._arrayValues[path];

					
				var msg = new osc.Message (	path );
				for ( var i = 0; i < arr.length; i ++ ) 
					msg.append ( arr[i] );
				client.send ( msg );		
			}			
		}
		this._arraySend = {};
	}
}
