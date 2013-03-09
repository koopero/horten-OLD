//	-------------
//	Listener Base
//	-------------


/** 
	options = {
		path: 		// Path to attach to,
		prefix: 	// Local path prefix
		catchAll:  	// Whether to call just on primatives with path
		horten: 	// Horten overide, default is Horten.getInstance ()
	} || path 
*/

Listener = function ( options, onData )
{
	if ( typeof options == 'string' ) {
		options = {
			path: options
		}
	}

	if ( typeof options == 'object' && options != null ) {
		this.path = Path ( options.path );
		this.prefix = Path ( options.prefix );

		this.primitive = !!options.primitive;
		this.horten = options.horten || Horten.instance ();
		this.onData = onData;

		if ( options.attach !== false )
			this.attach ();

	} else {
		this.horten = Horten.instance ();
	}

};

Listener.prototype.attach = function ()
{
	this.horten.attachListener ( this );
}

Listener.prototype.remove = function ()
{
	this.horten.removeListener ( this );
}

Listener.prototype.push = function ()
{
	if ( !this.primitive ) {
		this.onData ( this.horten.get( this.path ), Path ( this.prefix ), 'push', this );
	} else {
		var d = this.horten.get ( this.path, true );
		d = Horten.flattenObject( d );

		for ( k in d ) {
			this.onData ( d[k], Path ( k ).translate ( null, this.prefix ) );
		}
	}
}

Listener.prototype.get = function ( path )
{
	if ( path == undefined || path == null )
		path = this.prefix;
		
	path = Path ( path ).translate ( this.prefix, this.path );

	if ( path ) {
		return this.horten.get ( path );
	}

	return undefined;
}

Listener.prototype.set = function ( value, path, flags )
{
	if ( path == undefined || path == null )
		path = this.prefix;
	
	path = Path ( path ).translate ( this.prefix, this.path );

	if ( path )
		return this.horten.set ( value, path, this, flags );
	
	return null;
}

Listener.prototype.onData = function ( path, value )
{
	// Do what you will be here.
}