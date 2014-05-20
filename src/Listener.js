//	-------------
//	Listener Base
//	-------------


// #ifdef NODE
var 
	Path = require('./Path.js');

function instance () {
	return require('./Horten.js').instance();
}

var flatten = function () {
	flatten = require('./Horten.js').flatten;
	return flatten.apply( this, arguments );
}

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
	var horten;


	self.attach = function ( setPath, setHorten )
	{
		setPath = Path( setPath );
		setHorten = setHorten || self.horten || instance();

		if ( self.horten && setHorten != self.horten )
			self.horten.removeListener( self );

		self.horten = setHorten;

		if ( self.horten )
			self.horten.attachListener ( self );
	}

	self.remove = function ()
	{
		if ( self.horten )
			self.horten.removeListener ( self );
	}

	self.push = function ()
	{
		var horten = self.horten || instance();

		if ( !self.primitive ) {
			self.onData ( horten.get( self.path ), Path ( self.prefix ), 'push', self );
		} else {
			var d = horten.get ( self.path, true ), k;
			d = flatten( d );

			for ( k in d ) {
				self.onData ( d[k], Path ( k ).translate ( null, self.prefix ) );
			}
		}
	}

	self.get = function ( path )
	{
		if ( path == undefined || path == null )
			path = self.prefix;
			
		path = Path ( path ).translate ( self.prefix, self.path );

		if ( !self.horten )
			self.horten = instance();

		if ( path ) {
			return self.horten.get ( path );
		}

		return undefined;
	}

	self.set = function ( value, path, flags )
	{
		if ( path == undefined || path == null || path == '/' || path == '' )
			path = self.prefix;
		
		path = Path ( path ).translate ( self.prefix, self.path );

		if ( !self.horten )
			self.horten = instance();

		if ( path ) 
			return self.horten.set ( value, path, flags, self );
		
		return null;
	}

	self.localToGlobalPath = function ( path ) 
	{
		return Path ( path ).translate ( self.prefix, self.path );
	}

	self.globalToLocalPath = function ( path ) 
	{
		return Path ( path ).translate ( self.path, self.prefix );
	}

	self.onData = function ( path, value, method, origin )
	{
		if ( 'function' == typeof self.callback ) {
			self.callback( path, value, method, origin );
		}
		// Do what you will be here.
	}

	self.setPath = function ( newPath ) 
	{
		var wasAttached = !!self._attachedToPath;
		self.remove();
		self.path = Path( newPath );

		if ( wasAttached )
			self.attach();
	}

	if ( typeof options == 'string' || options instanceof Path ) {
		options = {
			path: options
		}
	}

	if ( typeof options == 'object' && options != null ) {
		self.path = Path( options.path );
		self.prefix = Path( options.prefix );

		self.primitive = !!options.primitive;
		
		
		if ( options.debug )
			self.debug = true;

		if ( 'function' == typeof onData )
			self.onData = onData;

		if ( options.attach !== false ) {
			horten = options.horten || instance();
			self.attach ();
		}

	}

};