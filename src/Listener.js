//	-------------
//	Listener Base
//	-------------


// #ifdef NODE
var 
	Horten = require('./Horten.js'),
	Path = require('./Path.js');

module.exports = Listener;
// #endif 

/** 
	options = {
		path: 		// Path to attach to,
		prefix: 	// Local path prefix
		catchAll:  	// Whether to call just on primatives with path
		horten: 	// Horten overide, default is Horten.getInstance ()
	} || path 
*/

function Listener ( options, onData )
{
	var self = this;
	if ( typeof options == 'string' ) {
		options = {
			path: options
		}
	}

	if ( typeof options == 'object' && options != null ) {
		self.path = Path( options.path );
		self.prefix = Path( options.prefix );

		self.primitive = !!options.primitive;
		self.horten = options.horten || Horten.instance();
		
		if ( options.debug )
			self.debug = true;

		if ( 'function' == typeof onData )
			self.onData = onData;

		if ( options.attach !== false )
			self.attach ();

	}
};

Listener.prototype.attach = function ( horten )
{
	var self = this;
	if ( horten ) {
		self.horten = horten;
	} 

	if ( !self.horten )
		self.horten = Horten.instance();

	self.horten.attachListener ( self );
}

Listener.prototype.remove = function ()
{
	var self = this;
	if ( self.horten )
		self.horten.removeListener ( self );
}

Listener.prototype.push = function ()
{
	var self = this;

	if ( !self.primitive ) {
		self.onData ( self.horten.get( self.path ), Path ( self.prefix ), 'push', self );
	} else {
		var d = self.horten.get ( self.path, true ), k;
		d = Horten.flatten( d );

		for ( k in d ) {
			self.onData ( d[k], Path ( k ).translate ( null, self.prefix ) );
		}
	}
}

Listener.prototype.get = function ( path )
{
	if ( path == undefined || path == null )
		path = this.prefix;
		
	path = Path ( path ).translate ( this.prefix, this.path );

	if ( !this.horten )
		this.horten = Horten.instance();

	if ( path ) {
		return this.horten.get ( path );
	}

	return undefined;
}

Listener.prototype.set = function ( value, path, flags )
{
	if ( path == undefined || path == null || path == '/' || path == '' )
		path = this.prefix;
	
	path = Path ( path ).translate ( this.prefix, this.path );

	if ( !this.horten )
		this.horten = Horten.instance();

	if ( path ) 
		return this.horten.set ( value, path, flags, this );
	
	return null;
}

Listener.prototype.localToGlobalPath = function ( path ) 
{
	return Path ( path ).translate ( this.prefix, this.path );
}

Listener.prototype.globalToLocalPath = function ( path ) 
{
	return Path ( path ).translate ( this.path, this.prefix );
}

Listener.prototype.onData = function ( path, value, method, origin )
{
	if ( 'function' == typeof this.callback ) {
		this.callback( path, value, method, origin );
	}
	// Do what you will be here.
}

Listener.prototype.setPath = function ( newPath ) 
{
	var wasAttached = !!this._attachedToPath;
	this.remove();
	this.path = Path( newPath );

	if ( wasAttached )
		this.attach();
}