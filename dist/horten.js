/**
 * horten v0.3.0 - 2013-10-21
 * Experimental shared-state communication framework. Speaks Javascript, MySQL, OSC and WebSocket.
 *
 * Copyright (c) 2013 koopero
 * Licensed MIT
 */
var urlParse = require('url').parse;

Horten.Path = Path;

function Path ( parse, horten ) {

	// Default to 
	horten = horten || Horten.instance();

  	// If the input given is already a parsed path,
 	// return it unchanged.
 	if ( parse && parse.constructor == Path ) {
 		if ( parse.horten == horten )
 			return parse;

 		parse = String( parse );
 	}

  	// Can be called as either Path or new Path
 	if ( this.constructor != Path ) {
 		return new Path ( parse, horten );
 	}
 	
 	// Convert to string
 	var str, arr;
 	if ( parse == null || parse == undefined ) {
 		str = '/';
	} else if ( Array.isArray ( parse ) ) {
    	str = parse.join('/');
	} else {
		// I'm kind of iffy about this...
		str = String ( parse );
	}

	// Normalize string
	if ( str != '/' ) {
		// Get rid of double slashes
		str = str.replace( /\/+/g, '/' );

		// Ensure leading slash
		if ( str.charAt(0,1) != '/' )
			str = '/'+str;

		// Ensure trailing slash
		if ( str.charAt(str.length - 1) != '/' )
			str = str+'/';
	}


	// Memoize Paths on horten
	if ( 'object' != typeof horten._paths )
		horten._paths = {};

	var memo = horten._paths;
	if ( memo[str] )
		return memo[str];

	memo[str] = this;

	// Get array
	if ( str == '/') {
		arr = [];
	} else {
		arr = str.substr ( 1, str.length - 2 ).split ( '/' );
	}

	for ( var i = 0; i < arr.length; i ++ ) {
		this[i] = arr[i];
	}


	this.slice = function ( start, end ) {
		return arr.slice ( start, end );
	}
 	this.string = str;
 	this.array = arr;
 	this.length = arr.length;
 	this.horten = horten;
}
 
Path.prototype.seg = function ( i ) {
	return this.array[i];
}


//	--------------------
//	Orthogonal Convience
//	--------------------

Path.prototype.set = function ( value, path, flags, origin, horten ) {
	horten = horten || this.horten || Horten.instance();

	if ( path == undefined )
		return horten.set( value, this, flags, origin );

	path = this.append ( path );

	return horten.set ( value, path, flags, origin );
}

Path.prototype.get = function ( path, horten ) {
	horten = horten || this.horten || Horten.instance();

	if ( path == undefined )
		return horten.get( this );

	path = this.append ( path );

	return horten.get ( path );	
}


Path.prototype.append = function ( postfix ) {
	return Path(this.string + postfix);
}

/**
	Translate the Path to a different domain and return the result. If the
	translation is impossible, undefined will be return. The first parameter,
	root, will be removed from the left side of the path. If the left side of 
	the path doesn't match, undefined will be returned. Then, the second parameter,
	prefix, will be added on the left side. Here's some examples:

		Path( 'foo/bar' ).translate ( 'foo' ) == '/bar/'
		Path( 'bar' ).translate ( null, 'foo' ) == '/foo/bar/'
		Path( 'foo/bar').translate ( 'baz', 'blu' ) == undefined
*/

Path.prototype.translate = function ( root, prefix ) {
	root = Path ( root );
	var rootStrLen = root.string.length;
	
	if ( this.string.substr( 0, rootStrLen ) != root.string )
		return undefined;
	
	prefix = Path ( prefix );
	
	if ( root.string == prefix.string )
		return this;
		
	return Path ( prefix.string + this.string.substr( rootStrLen ) );
}


Path.prototype.is = function ( compare ) {
	compare = Path ( compare );
	return this == compare;
}


Path.prototype.startsWith = function ( root ) {
	root = Path ( root );
	var rootStrLen = root.string.length;
	
	if ( this.string.substr( 0, rootStrLen ) != root.string )
		return false;

	return Path ( this.string.substr( rootStrLen ) );
}

Path.prototype.toString = function () {
	return this.string;
}
var nextTick;
if ( 'object' == typeof process && process['nextTick'] ) {
	nextTick = process.nextTick;
} else {
	nextTick = function ( callback ) {
		setTimeout( callback, 0 );
	}
}

/**
	Horten
	
	data - Contains the 
	
	meta -
	
*/

Horten.Horten = Horten;
function Horten ( options ) {
	if ( !options || 'object' != typeof options ) 
		options = {};

	if ( options.debug )
		this.debug = true;
		
	this.data = {};
	this.meta = {};
	
	if ( !Horten.__instance ) {
		Horten.__instance = this;
	}
}

/**
 *	Return the first instantiated Horten instance. Since most projects should
 *	only require a single Horten ( in fact, multiple Hortens could get really
 *	confusing and buggy ), this should be used rather than new Horten(). 
 */

Horten.instance = function ()
{
	if ( !Horten.__instance ) {
		Horten.__instance = new Horten ();
	}

	return Horten.__instance;
}

/**
	
	The 'original' parameter will skip cloning the returned value and return the
	original object. WARNING: Only use this if you promise ( cross your heart
	and hope to die! ) NOT to modify the returned object! If you do so, things
	will break unpredictably and it'll be your own damned fault!
*/ 

Horten.prototype.get = function ( path, original ) {
	path = Path ( path );
	
	var d = this.data;
	var p = path.array;
	var l = p.length;
	
	// Walk our data object to get the path we're after.
	for ( var i = 0; i < l && d != null; i ++ ) {
		d = d[p[i]];
	}
	
	// Do a deep clone of the result. 
	if ( !original ) {
		d = Horten.clone ( d );
	} 
	
	return d;
}



/**
	Enum of flags to be used with Horten.prototype.set.
*/
Horten.setFlags = {
	keepTopology: 	2,
	forceListeners: 4,
	replace:		8,
	readOnly: 		16 
}


/**
	@this {Horten}
	@param {*} value
	@param {path} path
	
	@param {Listener} origin	The Listener that sent this change. 

	@param {number} flags
	A few flags exist the alter the behaviour of the set command. They are passed
	as a bitfield, and the values are defined in Horten.setFlags.
	
		keepTopology - The set command will not alter the existing topology
			of the Horten data set. That is to say that while existing values
			will be changed, new values will not be created and value will
			not be changed between primitives and objects. This is useful
			to prevent untrusted clients from creating arbitrary keys,
			keeping the set constrained to an existing schema.
		
		forceListeners - Pretends that all primitive values are changed so 
			that all listeners are fired, regardless of whether the values
			are new. 
			
		replace - Rather than merging object together, which is Horten's
			default behaviour, delete old keys from the existing object.
			This is generally untested. Use at your own risk.
	
*/

Horten.prototype.set = function ( value, path, flags, origin ) {
	// Make sure path is proper before doing anything.
	path = Path ( path );

	flags = parseInt( flags );


	// I <3 JS
	var that = this;
	
	// Whether we actually changed anything.
	var touched = false;
		
	// The pointer to our current position in data
	var d = this.data;
	
	// The pointer to our current position in meta
	var m = this.meta;
	
	// Primitive listeners we're currently affecting.
	var lp = [];
	
	// Non-primitive listeners we're currently affecting.
	var lo = [];
	
	var p;
	var i;

	var pathLength = path.length;
	
	if ( 'object' != typeof value && pathLength == 0 ) {
		// This is the setting of the root value to a primitive,
		// which is something we really don't want to do,
		// and will break stuff. It might be worth throwing
		// an exception here, but for now return false and
		// do nothing.
		return false;
	}
	


	// Walk to one level short of where our given path tells
	// us to start. This will walk up the data variable,
	// as well as the meta variable, although if meta doesn't
	// continue, that's fine.
	for ( i = 0; i < pathLength - 1; i ++ ) {
		p = path.seg( i );
		var dp = d[p];
		
		if ( dp == null || 'object' != typeof dp ) {
			if ( flags & Horten.setFlags.keepTopology ) {
				// If the path we're looking to set doesn't
				// exist, bail here if we're keeping topology.
				return false;
			}
			d = d[p] = {};
			touched = true;
		} else {
			d = dp;
		}
		
		
		if ( m ) {
			// Along the way, collect the primitive and object
			// listeners.
			if ( m.lp )
				lp = lp.concat ( m.lp );
			
			if ( m.lo )
				lo = lo.concat ( m.lo );
			
			// _ is the property of meta that has
			// subpaths in it.
			if ( m['_'] ) 
				m = m['_'][p];
			else
				m = null;
		}	
	}
	
	// Get the last of the listeners.
	if ( m ) {
		if ( m.lp )
			lp = lp.concat ( m.lp );
			
		if ( m.lo )
			lo = lo.concat ( m.lo );
	}
	
	/*
	The actual business of setting the value involves two
	functions, 'merge' and 'set' recursively calling one
	another. 
	*/
	if ( pathLength == 0 ) {
		touched = merge ( value, d, m, '/', lp ) || touched;
	} else {
		p = path.seg( i );
		m = m && m['_'] && m['_'][p];
		touched = set ( p, value, d, m, path.toString(), lp ) || touched;
	}

	if ( touched ) {
		// Trigger the remaining object listeners
		triggerObjectListeners ( lo );
		
		// Defer flushing.
		// nextTick is defined above, and is either a setTimeout( 0 )
		// or node's process.nextTick()

		nextTick ( function () { that.flush() } );
	}
	
	return touched;

	function merge ( v, d, m, path, lp ) {
		var touched = false;
		var keys = v, k, i;
		
		if ( Array.isArray ( v ) ) {
			
			// We can't iterate arrays using for-in,
			// so iterate numerically and use those
			// keys to fill an object so it can be
			// used with a for-in later.
			keys = {};
			for ( i = 0; i < v.length; i ++ ) {
				if ( v[i] !== undefined ) {
					keys[String(i)] = true;
				} 
			}
		}
		
		// If the replace flag is set, delete all the
		// keys that don't exist in the new value.
		if ( flags & Horten.setFlags.replace ) {
			for ( k in d ) {
				if ( !(k in keys) ) {
					triggerPrimitiveListeners ( lp, path + k + '/', undefined, true );
					delete d[k];
				}
			}
		}
		
		// Do the actual setting of keys by calling 'set'.
		for ( k in keys ) {
			// If we're keeping topology, and the key doesn't already exist,
			// forget it.
			if ( d[k] === undefined && ( flags & Horten.setFlags.keepTopology ) ) {
				
				continue;
			}
		
			touched = set ( 
				k, 
				v[k], 
				d, 
				m && m['_'] && m['_'][k], // Walk the meta object, or silently pass undefined
				path + k + '/', lp
			 ) || touched;
		}

		return touched;
	}
	
	
	function set ( p, value, container, meta, path, lp ) {

		var touched = false;
		var currentValue = container[p];
		
		var currentIsOb = currentValue != null && 'object' == typeof currentValue;
		var newIsOb = value != null && 'object' == typeof value;
		

		if ( 
			!newIsOb && 
			currentValue === value && 
			!( flags & Horten.setFlags.forceListeners )
		) {
			// The value is unaltered
			return false;
		}
		
		if ( 
			( currentIsOb != newIsOb || currentValue === undefined ) &&
			( flags & Horten.setFlags.keepTopology )
		) {
			// We're not going to alter the topology of the data.
			return false;
		}
		
		if ( meta && meta.lp )
			lp = lp.concat ( meta.lp );
		
		
		if ( newIsOb ) {
			if ( !currentIsOb ) {
				// Upgrading primitive to object ( and losing 
				// the primitive value ).
				container[p] = currentValue = {};
			}
			touched = merge ( value, currentValue, meta, path, lp ) || touched;
		} else {
			if ( currentIsOb ) {
				// Downgrading an object tree to a primitive value.
				// This will result in a 'delete' event being fired.
				triggerPrimitiveListeners ( lp, path, undefined, true );
			}
		
			container[p] = value;
			touched = true;
			
			if ( that.debug ) {
				console.log ( origin ? origin.name : '<anon>', path, JSON.stringify( value ) ); 
			}
			
			triggerPrimitiveListeners ( lp, path, value );
		}

		if ( touched && meta && meta.lo ) {
			triggerObjectListeners ( meta.lo );
		}

		return touched;
	}
	
	function triggerObjectListeners ( listeners ) {
		for ( var i = 0; i < listeners.length; i ++ ) {
			var listener = listeners[i];
			
			if ( listener === origin )
				continue;
			
			listener._objectChange = {
				origin: origin,
				method: 'set'
			};
						
			if ( !that._pendingListeners )
				that._pendingListeners = [];
				
			if ( that._pendingListeners.indexOf ( listener ) == -1 )
				that._pendingListeners.push ( listener );
			
		}
	}
	
	function triggerPrimitiveListeners ( listeners, path, value, isDelete ) {
		
		for ( var i = 0; i < listeners.length; i ++ ) {
			
			var listener = listeners[i];
			
			if ( listener === origin )
				continue;
			
			if ( !listener._primitiveChanges ) 
				listener._primitiveChanges = {};
			
			var change = {};
			if ( !listener._primitiveChanges[path] )
				change = listener._primitiveChanges[path] = {};
			else
				change = listener._primitiveChanges[path];
				
			change.origin = origin;
			
			if ( isDelete ) {
				change.deleted = true;
			} else {
				change.value = value;
			}
			
			if ( !that._pendingListeners )
				that._pendingListeners = [];
				
			if ( that._pendingListeners.indexOf ( listener ) == -1 )
				that._pendingListeners.push ( listener );
			
		}
	}
}

//	--------------------
//	Orthogonal Convience
//	--------------------

Horten.set = function ( value, path, flags, origin ) 
	{	return Horten.instance().set ( value, path, flags, origin ); }
Horten.get = function ( path, original ) 
	{	return Horten.instance().get ( path, original ); }
Horten.listen = function ( path, callback, options ) 
	{	return Horten.instance().listen ( path, callback, options ); }
Horten.listenPrimitive = function ( path, callback, options ) 
	{	return Horten.instance().listenPrimitive ( path, callback, options ); }

/**
	Returns the meta object at a given path. If the create parameter is
	true, a meta object will be created and its existence guaranteed. If
	not, undefined will be return if the meta path does not exist.
*/
Horten.prototype.getMeta = function ( path, create ) 
{
	path = Path ( path );
	
	var m = this.meta;
	var i = 0, p;
	
	while ( p = path.seg ( i ) ) {
		if ( !m['_'] ) {
			if ( create ) 
				m['_'] = {};
			else
				return undefined;
		}
		
		if ( !m['_'][p] )
			m['_'][p] = {};
		
		m = m['_'][p];
		i ++;
	}		
	
	return m;
}

Horten.prototype.log = function ()
{
	var args = Array.prototype.slice.call( arguments );
	console.log ( args.map( String ).join('\t') );
}

//	---------
//	Listeners
//	---------

Horten.prototype.listen = function ( path, callback, options )
{
	if ( !options )
		options = {};

	options.path = Path( path );

	var listener = new Listener ( options );
	listener.callback = callback;
	this.attachListener( listener );
	return listener;
}

Horten.prototype.listenPrimitive = function ( path, callback, options )
{
	if ( !options )
		options = {};

	options.path = Path( path );
	options.primitive = true;

	var listener = new Listener ( options );
	listener.callback = callback;
	this.attachListener( listener );
	return listener;
}

/**
	Attach a listener to the Horten tree. Technically, a listener could
	be any old object, but you're much better using a Listener object,
	which will automatically attach itself. 
	
	If you want to make an attach a listener manually, here are the
	important properties which horten will use. Note that once the listener
	is added, changing the path, primitive, prefix and horten values will
	not change the listener's behaviour unless it is reattached.
	
		path			The path that the listener listens to. Should probably
						be a Path object.
		primitive		Whether the listener will receive primitive value at
						their respective subpaths, rather than a whole
						object at it's path. 
		prefix			A path that will prefixed ahead of the relative path.
		horten			The Horten instance the listener is associated with. Don't
						change this without first removing the listener.
		onData			The callback for receiving data from Horten. This is
						called with the parameters ( value, path, method, origin ),
						although method, origin and, in the case of non-primitive
						listeners, can be ignored.
						
		Additionally, Horten will create the following properties for its own
		use. Don't mess with these, especially _attachedToPath. It will
		break stuff.
						
		_attachedToPath		The path the listener has been attached to.
		_primitiveChanges	
		_objectChange		Changes pending a flush
*/
Horten.prototype.attachListener = function ( listener ) 
{
	if ( listener.horten && listener.horten != this ) {
		listener.horten.removeListener ( listener );
	} else {
		this.removeListener ( listener );
	}
	
	var path = Path ( listener.path );
	listener._attachedToPath = path;
	listener.horten = this;
	
	var m = this.getMeta ( path, true );
	
	var arrKey = listener.primitive ? 'lp' : 'lo';
	
	if ( m[arrKey] == undefined ) {
		m[arrKey] = [ listener ];
	} else {
		m[arrKey].push ( listener );
	}
	
}

/** 
	Remove a listener object from this Horten instance.
*/
Horten.prototype.removeListener = function ( listener )
{
	if ( listener.horten && listener.horten != this ) {
		throw 'Trying to remove listener attached to different Horten instance';
	}

	if ( listener._attachedToPath ) {

		var path = Path ( listener._attachedToPath );
		var m = this.getMeta ( path, false );
		
		function deleteFromArray ( arrayName ) {
			if ( m[arrayName] ) {
				var ind = m[arrayName].indexOf ( listener );
				if ( ind != -1 )
					m[arrayName].splice( ind, 1 );
				
				if ( m[arrayName].length == 0 )
					delete m[arrayName];
			}
		}

		if ( m ) {
			deleteFromArray ( 'lp' );
			deleteFromArray ( 'lo' );
		}
		

		
		delete listener._attachedToPath;
		//	It would be nice to walk back through the meta tree, deleting
		//	empty meta objects as we go, but I don't feel like it right now.
	}

	if ( this._pendingListeners ) {
		this._pendingListeners = this._pendingListeners.filter ( function ( pendingListener ) {
			return pendingListener != listener;
		});
	}

}

/** 
	Flush all pending callbacks to listeners. Normally, this is done automatically
	using a delayed call from Horten.prototype.set, but in exceptional circumstances,
	it can be done manually.
*/
Horten.prototype.flush = function ()
{
	var that = this;
	
	var listeners = this._pendingListeners;
	
	if ( listeners && listeners.length ) {
		for ( var i = 0; i < listeners.length; i ++ ) {
			var listener = listeners[i];
						
			var prim = listener._primitiveChanges;
			var ob = listener._objectChange;
			var callback = listener.onData;
			var listenerPath = Path( listener.path );
			var listenerPrefix = Path( listener.prefix );
			
			delete listener._primitiveChanges;
			delete listener._objectChange;
			
			if ( 'function' != typeof callback )
				continue;
						
			if ( prim ) {
				for ( var k in prim ) {
					var o = prim[k];
					var path = Path(k).translate( listenerPath, listenerPrefix );
					
					if ( o.deleted ) {
						callback.call( listener, undefined, path, 'delete', o.origin );
						
						if ( o.value !== undefined ) 
							callback.call( listener, o.value, path, 'set', o.origin );
					} else {
						callback.call( listener, o.value, path, 'set', o.origin );
					}
					
				}
			}
			
			if ( ob ) {
				callback.call( listener, that.get( listenerPath ), listenerPrefix, ob.method, ob.origin );
			}
		}
	}
	
	delete this._pendingListeners;
}

//	-----------------
//	Utility functions
//	-----------------


/** 
	Merge two objects together, using more or less the same rules as Horten.set, except
	without calling listeners and all that jazz.
**/

Horten.merge = function ( object, value, path, flags ) 
{
	// Make sure path is proper before doing anything.
	path = Path ( path );

	// Whether we actually changed anything.
	var touched = false;
		
	// The pointer to our current position in data
	var d = object;

	var p;
	var i;

	var pathLength = path.length;
	
	if ( 'object' != typeof object ) {
		if ( path == '/') {
			return value;
		} else if ( typeof object != typeof value ) {
			d = object = {};
		} 
	}



	// Walk to one level short of where our given path tells
	// us to start. This will walk up the d variable.
	for ( i = 0; i < pathLength - 1; i ++ ) {
		p = path.seg( i );
		
		if ( d[p] == null || 'object' != typeof d[p] ) {
			if ( flags & Horten.setFlags.keepTopology ) {
				// If the path we're looking to set doesn't
				// exist, bail here if we're keeping topology.
				return object;
			}
			d = d[p] = {};
		} else {
			d = d[p];
		}
	}

	
	/*
	The actual business of setting the value involves two
	functions, 'merge' and 'set' recursively calling one
	another. 
	*/
	if ( pathLength == 0 ) {
		merge ( value, d, '/' );
	} else {
		p = path.seg( i );
		set ( p, value, d, path.toString() );
	}
	
	return object;

	function merge ( v, d ) {
		var keys = v, k, i;
		
		if ( Array.isArray ( v ) ) {
			
			// We can't iterate arrays using for-in,
			// so iterate numerically and use those
			// keys to fill an object so it can be
			// used with a for-in later.
			keys = {};
			for ( i = 0; i < v.length; i ++ ) {
				if ( v[i] !== undefined ) {
					keys[String(i)] = true;
				} 
			}
		}
		
		// If the replace flag is set, delete all the
		// keys that don't exist in the new value.
		if ( flags & Horten.setFlags.replace ) {
			for ( k in d ) {
				if ( !(k in keys) ) {
					delete d[k];
				}
			}
		}
		
		// Do the actual setting of keys by calling 'set'.
		for ( k in keys ) {
			// If we're keeping topology, and the key doesn't already exist,
			// forget it.
			if ( d[k] === undefined && ( flags & Horten.setFlags.keepTopology ) )
				continue;
		
			set ( 
				k, 
				v[k], 
				d
			 );
		}

	}
	
	
	function set ( p, value, container ) {
		var currentValue = container[p];
		
		var currentIsOb = currentValue != null && 'object' == typeof currentValue;
		var newIsOb = value != null && 'object' == typeof value;
		
		if ( 
			!newIsOb && 
			currentValue === value
		) {
			// The value is unaltered
			return false;
		}
		
		if ( 
			( currentIsOb != newIsOb || currentValue === undefined ) &&
			( flags & Horten.setFlags.keepTopology )
		) {
			// We're not going to alter the topology of the data.
			return false;
		}
		
		
		if ( newIsOb ) {
			if ( !currentIsOb ) {
				// Upgrading primitive to object ( and losing 
				// the primitive value ).
				container[p] = currentValue = {};
			}
			merge ( value, currentValue );
		} else {
			container[p] = value;
		}
	}
}

Horten.walkObject = function ( d, path, original ) {
	path = Path ( path );
	
	var p = path.array;
	var l = p.length;
	
	if ( d == null ) {
		return undefined;
	}

	// Walk our data object to get the path we're after.
	for ( var i = 0; i < l && d != null; i ++ ) {
		d = d[p[i]];
	}
	
	// Do a deep clone of the result. 
	if ( !original ) {
		d = Horten.clone( d );
	} 
	
	return d;
}

/*
	Clone an object. Been done a million time, this one ain't much different.
*/
Horten.clone = function ( ob ) {
	return 'object' == typeof ob ? clone( ob ) : ob;

	function clone ( ob ) {
		var ret = {}, k, v;
		for ( var k in ob ) {
			v = ob[k];
			if ( v !== null && 'object' == typeof v ) {
				ret[k] = clone( v );
			} else {
				ret[k] = v;
			}
		}
		
		return ret;
	}
}

/** 
	Flatten an object. Given an object, return an object with each property of the object and 
	sub-objects as a single level hash with the key being a slashed path. For example:
	
	{ 'a': 1, 'b': 2 }  =>   { '/a/': 1, '/b/':2 }
	{ 'a': { 'b': 1, 'c': 2 } } => { '/a/b/': 1, '/a/c/': 2 }
	'foo' => { '/': 'foo' }
	 
	@param ob		The data to be flattened.
	@param path  	The path parameter allows the keys to be prefix with a path.  Example:
		flattenObject ( { 'a': 1, 'b': 2 }, 'c' ) => { '/c/a/': 1, '/c/b/': 2 }
	@returns 		The flattened object.
 */

Horten.flatten = function ( ob, path ) {
	path = Path ( path )
	
	var ret = {};
	flatten ( ob, path.string );	
	return ret;
	
	function flatten ( ob, path ) {
	
		switch ( typeof ob ) {
			// Stuff we can't deal with
			case 'function': 
			case 'undefined':
				return;
		
			//	Take care of primitive types
			case 'number':
			case 'string':
			case 'boolean':
				ret[path] = ob;
				return;
		}
		
		// Assume by now typeof is object
		
		// Null is an object, apparently. That's fucking genius.
		if ( ob === null ) {
			ret[path] = null;
			return;
		}
		
		// It's an array, which apparently doesn't work with a for-in
		// iterator.
		if ( Array.isArray ( ob ) ) {
			
			for ( var i = 0; i < ob.length; i ++ ) {
				var v = ob[i];
				if ( ( typeof v ) != 'undefined' )
					flatten( v, path+String(i)+'/' );
			}
			
			return;
		}
		
		// Now, it's a real object
		for ( var k in ob ) {
			flatten ( ob[k], path+k+'/' );
		}
	}

};

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
Horten.Listener = Listener;

function Listener ( options, onData )
{
	if ( typeof options == 'string' ) {
		options = {
			path: options
		}
	}

	if ( typeof options == 'object' && options != null ) {
		this.path = new Path ( options.path );
		this.prefix = new Path ( options.prefix );

		this.primitive = !!options.primitive;
		this.horten = options.horten || Horten.instance ();
		
		if ( options.debug )
			this.debug = true;

		if ( 'function' == typeof onData )
			this.onData = onData;

		if ( options.attach !== false )
			this.attach ();

	}
};

Listener.prototype.attach = function ( horten )
{
	if ( horten ) {
		this.horten = horten;
	} 

	if ( !this.horten )
		this.horten = Horten.instance();

	this.horten.attachListener ( this );
}

Listener.prototype.remove = function ()
{
	if ( this.horten )
		this.horten.removeListener ( this );
}

Listener.prototype.push = function ()
{
	if ( !this.primitive ) {
		this.onData ( this.horten.get( this.path ), Path ( this.prefix ), 'push', this );
	} else {
		var d = this.horten.get ( this.path, true ), k;
		d = Horten.flatten( d );

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
HortenMySQL.prototype = new Listener ( false );
HortenMySQL.prototype.contructor = HortenMySQL;

/**
	Config

		connection 	Either a mysql connection, or something to pass to mysql.createConnection.
					Usually in a format like { host: 'local', port: 3306, etc }

		keepAlive 	Set to false to die when the connection closes, rather than
					reconnecting.

		table 		The main data table.

		pathTable   The table in which to store paths. If this is defined, two tables will
					be created rather than one. See schema.

		history

		timeOffset	

		timeQuant	



*/

function HortenMySQL ( config ) {

	if ( 'string' == typeof config.connection ) {
		var u = urlParse( config.connection );
		var userPass = String(u.auth).split(':');
		var urlPath = u.pathname.substr(1).split('/');

		if ( urlPath.length != 2 )
			throw new Error ( 'connection url must be in form mysql://user:pass@hostname/database/table' );

		config.connection = {
			host: u.hostname,
			user: userPass[0],
			port: u.port || 3306,
			password: userPass[1],
			database: urlPath[0]
		};

		config.table = config.table || urlPath[ 1 ];
	}


	if ( config.timeOffset )
		this.timeOffset = -Date.parse ( config.timeOffset );
	else
		this.timeOffset = 0;

	if ( config.timeQuant )
		this.timeQuant = parseFloat ( config.quantizeTime );
	else
		this.timeQuant = 1000;


	this.history = !!config.history;

	// Questionable magic number
	this.pathLength = parseInt ( config.pathLength ) || 640;

	// I <3 JS :P	
	var that = this;

	this.keepAlive = undefined == config.keepAlive || !!config.keepAlive;

	this.primitive = config.primitive = true;

	// Listener base
	Listener.call( this, config, this.onData );

	this.debug = !!config.debug;

	//
	//	Apply defaults and parse connection and table parameters.
	//

	// The table which holds our paths
	this.pathTable = config.pathTable ? String ( config.pathTable ) : false;

	// The table which holds our data
	this.dataTable = String ( config.table );



	// The columns we're going to use. Includes special
	// columns such as 'time'
	if ( Array.isArray ( config.columns ) ) {
		var cols = {};
		for ( var i = 0; i < config.columns.length; i ++ ) {
			var c = config.columns[i];
			cols[c] = c;
		}
		config.columns = cols;
	}

	this.columns = config.columns && typeof config.columns == 'object' ? config.columns : {};

	// Set default, required columns
	var defaultCols = [ 'path', 'json' ];
	
	if ( this.pathTable )
		defaultCols.push ( 'pathId' );

	if ( this.history )
		defaultCols.push ( 'time' );

	for ( var col in defaultCols ) {
		col = defaultCols[col];
		if ( !this.columns[col] || 'string' != typeof this.columns[col] )
			this.columns[col] = col;
	}



	//
	//	Assemble create table commands
	//

	var create = [];

	if ( this.pathTable ) {
		create.push ( 
			'CREATE TABLE IF NOT EXISTS `'+this.pathTable+'` ('+
			'`'+this.columns['pathId']+'` int(20) NOT NULL AUTO_INCREMENT, '+
			'`'+this.columns['path']+'` varchar('+this.pathLength+') NOT NULL, '+
			'PRIMARY KEY (`'+this.columns['pathId']+'`),'+
			'UNIQUE KEY `'+this.columns['path']+'`  (`path`) '+
			') ENGINE=InnoDB;'	
		);
	}

	if ( this.dataTable ) {
		var sql = 	'CREATE TABLE IF NOT EXISTS `'+this.dataTable+'` (';

		var keyCol;
		if ( this.pathTable ) {
			keyCol = this.columns['pathId'];
			sql += 	'`'+keyCol+'` int(20) NOT NULL AUTO_INCREMENT, ';
		} else {
			keyCol = this.columns['path'];
			sql +=	'`'+keyCol+'` varchar('+this.pathLength+') NOT NULL, ';
		}

		if ( this.columns['time'] ) {
			sql +=	'`'+this.columns['time']+'` BIGINT DEFAULT NULL, ';
			sql += 	'KEY `'+this.columns['time']+'` ( `'+this.columns['time']+'` ), ';
		}

		if ( this.columns['number'] )
			sql +=	'`'+this.columns['number']+'` double DEFAULT NULL, ';

		if ( this.columns['json'] )
			sql +=	'`'+this.columns['json']+'` text, ';

		if ( this.columns.origin ) 
			sql +=	'`'+this.columns.origin+'` varchar(255), ';

		if ( this.columns.method ) 
			sql +=	'`'+this.columns.method+'` char(8), ';
		


		if ( !this.history )
			sql +=	'PRIMARY';

		sql += 	' KEY `'+keyCol+'` (`'+keyCol+'`) ';
		
		sql += ') ENGINE=InnoDB;'

		create.push ( sql );

	}

	//
	//	Initialize Connection
	//
	function connect ( connection ) {

		if ( 'object' != typeof connection ) {
			// Need something!
			throw 'Connection details not specified';
		} else if ( connection._protocol ) {
			// A flaky way of determining if the connection passed in config
			// is a real connection, as oppose to the configuration for one.
		} else {
			connection = require ( 'mysql' ).createConnection ( connection );
		}

		connection.on('error', function ( err ) {
			that.horten.log ( that.name, 'error', JSON.stringify ( err.code ) );
		});

		connection.on('close', function ( err ) {
			if ( err && that.keepAlive ) {
				console.log ( that.name, 'Reconnecting' );
				connect(connection.config);
			} else {
				that.remove();
			}
		});	

		that.connection = connection;
		
		connection.connect( function ( err ) {
			if ( !err ) {
				that.connected = true;
				that.flush();
			} else {
				// Handle bad connection here!
			}
		});
	}

	connect ( config.connection );

	var cc = this.connection.config;
	this.name = 'mysql://'+cc.host+'/'+cc.database+'.'+this.dataTable;

	
	this.query = function ( sql, callback ) {
		if ( that.debug ) {
			console.log ( that.name, sql );
		}
		that.connection.query ( sql, callback );
	}



	for ( var i = 0; i < create.length; i ++ ) {
		var sql = create[i];
		this.query ( sql, 
			function ( err, result ) {
				if ( err ) {
					that.horten.log( that.name, "Error creating table" );
					throw 'SQL Error';
				}
			}
		);
	}




	// Magic object to declare that a path is being looked up.
	this._pathLookingUp = {};

	// State variables
	this.pathIds = {};
	this._queue = [];


	this.attach ();

}

HortenMySQL.prototype.close = function ()
{
	this.keepAlive = false;
	this.connection.end ();
}

/**
	Return an escaped mysql value ( DATETIME or number ) for a given date,
	adjusting quantization and format.
*/

HortenMySQL.prototype.escapeDate = function ( date )
{
	date = new Date ( date );
	var timeStamp = date.getTime ();

	timeStamp -= this.timeOffset;
	timeStamp /= this.timeQuant;
	
	return parseInt ( timeStamp )
}

HortenMySQL.prototype.pull = function ( callback, time )
{
	var sql 	 = "SELECT * FROM `"+this.dataTable+"` ";

	if ( this.pathTable )
		sql 	+= 'NATURAL JOIN `'+this.pathTable+'` ';

	if ( this.history ) {
		if ( time || 0 == time ) {
			sql += 'WHERE `'+this.columns.time+'` <= '+this.escapeDate ( time );
		} else {
			sql += 'WHERE 1 ';	
		}

		sql 	+= 'GROUP BY `'+this.columns.path+'` ';
		sql 	+= 'ORDER BY `'+this.columns.time+'` DESC ';
	} else {
		sql 	+= 'WHERE 1 ';
	}

	var that = this;

	
	this.query ( sql, 
		function ( err, result ) {
			if ( result ) {
				var set = {};
				for ( var i = result.length - 1; i >= 0; i -- ) {
					var row = result[i];
					var path = row.path;
					
					var value;
					if ( row[that.columns.json] != null ) {
						try {
							value = JSON.parse ( row[that.columns.json] );
						} catch ( e ) {
							console.log ( that.name, 'ignoring bad JSON on pull' );
							continue;
						}
					} else if ( that.columns.number && row[that.columns.number] != null ) {
						value = parseFloat ( row[that.columns.number] );
					} else {
						// We don't know what to do with the row we've
						// been given.
						continue;
					}
					
					Horten.merge ( set, value, path ) ;
				}

				that.set ( set, that.prefix );
				
				if ( callback )
					callback ();
			}
			
			//console.log ( "err="+JSON.stringify(err)+" result="+JSON.stringify(result) );
		} 
	);
}

/** 
 * Translates a path into an appropriate format for our database table. If the table is configured to
 * use a string path, this is as easy as returning the path. However, if we want to use a numeric path_id
 * to save space, it's a bit more complicated. A cache of string paths to numeric path_ids is kept in
 * the variable pathIds. If getPathId finds a value here, it will return it. Otherwise, it will start a
 * query to fetch the value from the database and return null.
 * 
 * @param path
 * @returns 
 */
HortenMySQL.prototype.getPathId = function ( path )
{
	path = Path ( path );

	// If there's no table for paths,
	// we've got nothing to do.
	if ( !this.pathTable )
		return path.toString();

	if ( this.pathIds[path] === this._pathLookingUp )
		return null;	
	
	if ( this.pathIds[path] )
		return this.pathIds[path];
	

	
	this.pathIds[path] = this._pathLookingUp;
	
	var sql = 	'SELECT `'+this.columns['pathId']+'` FROM `'+this.pathTable+'` '+
				' WHERE `'+this.columns['path']+'`='+this.connection.escape ( path.string );

	var that = this;
	
	this.query ( sql,
		function ( err, result ) {
			if ( result && result[0] && result[0][that.columns['pathId']]) {
				that.pathIds[path] = parseInt( result[0][that.columns['pathId']] );
				that.flush();
			} else {
				// Insert
				var sql = "INSERT INTO "+that.pathTable+
				' ( `'+that.columns['path']+'` ) VALUES ( '+that.connection.escape ( path.string )+")";

				that.query ( sql,
					function ( err, result ) {
						if ( result && result.insertId ) {
							that.pathIds[path] = result.insertId;
						}
						
						that.flush ();
					} 
				);
			}	
		} 
	);
	
	return null;
}


HortenMySQL.prototype.onData = function ( value, path, method, origin )
{
	//console.log ( "MYSQL ONDATA", value, path, method, origin );

	var time = this.escapeDate( new Date () );
	
	var out = [ path, value, time, method, origin ];
	this._queue.push( out );
	
	this.flush ();
}

HortenMySQL.prototype.flush = function ( callback )
{
	var that = this;

	if ( this._queue.length == 0 ) {
		if ( this._flushCallbacks && this._flushCallbacks.length ) {
			this._flushCallbacks.forEach ( function ( cb ) {
				cb();
			});
			this._flushCallbacks = [];
		}

		if ( 'function' == typeof callback ) {
			process.nextTick ( function() {
				callback ();
			} );
		}

		return;
	} else if ( 'function' == typeof callback ) {
		if ( !this._flushCallbacks )
			this._flushCallbacks = [];

		this._flushCallbacks.push ( callback );
	}

	if ( !that.connected ) {
		return;
	}

	var c = this.columns;
	var e = function ( v ) { 
		that.connection.escape ( v );
	};

	var sentQueries = 0;

	for ( var i = 0; i < this._queue.length; i ++ ) {

		var out = this._queue[i];
		var path 	= out[0];

		var pathId = this.getPathId ( path );
	
		if ( pathId ) {
			this._queue.splice ( i, 1 );
			i --;

			var value 	= out[1];
			var time 	= out[2];
			var method 	= out[3];
			var origin  = out[4];	

			var sql;

			if ( method == 'delete' && !this.history ) {
				var pathLike = '`'+c.path+'` LIKE '+that.connection.escape (path+'%');

				sql 	 = 'DELETE FROM ';
				sql 	+= ' `'+this.dataTable+'` WHERE ';

				if ( this.pathTable ) {
					sql += ' `'+c.pathId+'` IN ';
					sql += ' ( SELECT `'+c.pathId+'` FROM `'+this.pathTable+'` WHERE ';
					sql += pathLike;
					sql += ' )'
				} else {
					sql += pathLike;
				}

			} else {
				var set		= {};
				var type 	= typeof value;

				sql = this.history ? 'INSERT' : 'REPLACE';
				sql += ' `'+this.dataTable+'` SET '; 

				set[ c.pathId || c.path ] = pathId;
				
				if ( c.time  )
					set[c.time] = time;
				
				if ( 'object' == typeof origin )
					origin = origin.name;

				if ( origin && c.origin ) 
					set[c.origin] = origin;
				
				if ( method && c.method ) 
					set[c.method] = method;


				if ( type == 'number' && this.columns.number ) {
					set[c.number] = value;
				} else if ( this.columns.json ) {
					set[c.json] = JSON.stringify ( value );
				} else {
					// We've got no columns that hold data, so nothing to write.
					continue;
				}
				sql 	+= that.connection.escape( set );
			}
			
			this.query ( sql, countCallbacks );
			sentQueries ++;
		} else {
			// If we're stuck retrieving pathIds, don't continue.
			// Hopefully, this will prevent things being out of
			// order, especially deletes.
			break;
		}
	}
	
	function countCallbacks ( err ) {
		if ( !err ) {
			sentQueries --;
			if ( sentQueries == 0 ) {
				that.flush();
			}
		}
	}


}

Horten.MySQL = HortenMySQL;
function Connection ( config ) {
	config.primitive = true;

	this.keepAlive = config.keepAlive;
	
	Listener.call ( this, config );
}

Connection.prototype = new Listener( null );

/** 
 * Queue one or more paths to pull from the server. This will ask the server
 * to immediately send the values of the paths. Typically, this would be used
 * to get the server's entire state on connection. When called with no
 * arguments, the root will be pulled. 
 * 
 *  This function can be called before the client has connected.
 * 
 * @param paths
 */
Connection.prototype.pull = function ( path )
{
	path = Path( path ).string;

	if ( !this._pullPaths )
		this._pullPaths = [];
	
	if ( this._pullPaths.indexOf ( path ) == -1 )
		this._pullPaths.push ( path );
	
	this._pull ();
};

Connection.prototype._pull = function () 
{
	if ( !this._pullPaths || !this._pullPaths.length )
		return;

	if ( !this.readyToSend () ) {
		return;
	}
	
	var msg = {
		get: this._pullPaths
	};

	if ( this.send ( msg ) ) {
		this._pullPaths = null;
	} 

}


Connection.prototype.push = function ( path )
{
	path = Path ( path );

	if ( !this._pushData )
		this._pushData = {};

	this._pushData[path] = this.FILL_DATA;
	this._push();
}

Connection.prototype._push = function ()
{
	if ( !this._pushData )
		return;

	if ( !this.readyToSend() ) {
		return;
	}

	var somethingToSend = false;
	
	for ( var remotePath in this._pushData ) {
		
		somethingToSend = true;
		
		if ( this._pushData[ remotePath ] == this.FILL_DATA ) {
			this._pushData[ remotePath ] = this.get ( remotePath );
		}
	}
	

	if ( somethingToSend ) {
		this.send ( { set: this._pushData } );
	}
	
	this._pushData = {};	
}

Connection.prototype.readyToSend = function ()
{
	return false;
}

/**
 * Called when the other end of the connection drops
 * unexpectedly.
 */

Connection.prototype.onRemoteClose = function ()
{	
	var that = this;
	if ( this.keepAlive && 'function' == typeof this.reconnect ) {
		console.log ( that.name, 'Remote closed, retrying in 1 second' );

		setTimeout ( function () {
			that.reconnect ();
		}, 1000 );
	} else {
		console.log ( that.name, 'Closed by remote' );
		
		this.close();
	}
}

Connection.prototype.onData = function ( value, path )
{
	if ( !this._pushData )
		this._pushData = {};
	
	this._pushData[path] = value;

	// Should delay push here
	this._push();
}

Connection.prototype.onRemoteData = function ( msg ) {

	if ( this.debug ) {
		console.log ( this.name, "RECV", msg );
	}

	if ( 'string' == typeof msg ) {
		try {
			msg = JSON.parse ( msg );
		} catch ( e ) {
			console.log ( this.name, 'Bad JSON from remote' );
			return;
		}
	}

			
	if ( msg.set ) {
		var set = {};
		//console.log ( 'msg.set '+JSON.stringify ( msg.set ) );
		
		for ( var remotePath in msg.set ) {
			
			var value = msg.set[remotePath];

			this.set ( value, remotePath );
		}
		
		//console.log ( "GOT MESG set", set );

	}
	
	if ( msg.get ) {
		this.push( msg.get );
	}
}

/** Close the connection with no hope of reopening */
Connection.prototype.close = function ()
{
	this.remove();
	this.keepAlive = false;
	
	if ( 'function' == typeof this._close ) {
		this._close();
	}
};


//
//	Various things to attach.
//

Connection.prototype.attachWebSocket = function ( websocket ) {
	var that = this;
	
	websocket.onopen = function () 
	{
		console.log ( that.name, 'Open WS' );
		that._push ();
		that._pull ();
	};
	
	websocket.onerror = function ( error ) 
	{
		console.log ( that.name, "WS error " +JSON.stringify(error) );
	};
	
	websocket.onmessage = function ( msg )
	{
		that.onRemoteData ( msg.data );		
	};
	
	websocket.onclose = function ()
	{
		//console.log ( that.name, "onclose" );
		that.onRemoteClose ();
	};	

	this.readyToSend = function () {
		return websocket.readyState == 1;
	}

	this.send = function ( msg ) {
		if ( websocket.readyState != 1 ) 
			return false;


		msg = JSON.stringify ( msg );
		websocket.send ( msg );

		return true;
	}

	this._close = function () {
		websocket.close ();
	}

	if ( websocket.readyState == 1 ) {
		that._push ();
		that._pull ();
	}
}

Connection.prototype.attachSockJSClient = function ( sock, remotePath, config ) {
	that = this;
	that.sockJS = sock;
	remotePath = Path ( remotePath ).string;
		
	sock.onopen = function () {
		sock.send ( JSON.stringify ( {
			path: remotePath
		}))
	}

	sock.onmessage = function ( msg ) {
		try {
			msg = JSON.parse ( msg.data );
		} catch ( e ) {
			console.log ( that.name, "Bad JSON in server path response", msg );
			sock.close();
			that.onRemoteClose ()
			return;
		}

		if ( msg ) {
			that.attachWebSocket ( sock );
			that.onRemoteData ( msg );
		} else {
			console.log ( that.name, "Didn't get path handshake from server" );
			sock.close ();
			that.onRemoteClose ();
		}
	}

	sock.onclose = function () {
		console.log ( that.name, "Didn't get path handshake from server" );
		that.onRemoteClose ();
	}

	sock.onerror = function () {

	}
}
Horten.Client = Client;


var wsProtocol = 'horten-protocol';


function Client ( url, options, callback ) {

	if ( this instanceof Client ) {
		throw new Error ( "Not a constructor" );
	}

	if ( !options )
		options = {};

	options.keepAlive = options.keepAlive !== false;
	


	var urlStr;

	if ( 'string' == typeof url ) {
		urlStr = url;
		url = urlParse( url, true );
	} else if ( Array.isArray ( url ) ) {
		var client, i;
		for ( i = 0; i < url.length && !client; i++ ) {
			//try {
				client = Client ( url[i], options, callback )
			//} catch (e) {}

			if ( client ) 
				return client;
		}

		throw new Error ( 'No compatible connect method')

	} else {
		throw new Error ( 'parameter unsupported');
	}

	console.log ( "TRYING CONNNECT", url );
	var listener;

	if ( url.protocol == 'ws:' ) {
		// Web Socket
		listener = new Connection ( options )

		listener.name = urlStr;

		var client;

		if ( 'function' == typeof require && 'undefined' != typeof exports ) {
			var client;

			listener.reconnect = function () {

				client = new (require('websocket').client);

				client.on('connectFailed', function ( error ) {
					console.log ( listener.name, 'Connecting failed' );
					listener.onRemoteClose ()
				});

				client.on('connect', function ( conn ) {
					console.log ( listener.name, 'Connected ' );
					listener.wsn = conn;

					conn.on('close', function () {
						listener.onRemoteClose ();
					});

					conn.on('message', function ( message ) {
						if ( message.type != 'utf8' ) {
							console.log ( listener.name, 'Not UTF8 from remote' );
							return false;
						}
						listener.onRemoteData ( message.utf8Data );
					});

					listener._push ();
					listener._pull ();
				});
				client.connect ( urlStr, wsProtocol );
			}

			listener.readyToSend = function () {
				return listener.wsn && listener.wsn.connected;
			}

			listener.send = function ( msg ) {
				if ( !listener.wsn || !listener.wsn.connected )
					return false;

				listener.wsn.sendUTF ( JSON.stringify ( msg ) );
				return true;
			}

			


		} else if ( 'function' == typeof WebSocket || 'object' == typeof WebSocket ) {
			listener.reconnect = function () {
				console.log ( "WebSocket connecting to", url );
				client = new WebSocket ( urlStr, wsProtocol );

				listener.attachWebSocket ( client );
			}
		} else {
			//throw new Error ( 'No WebSocket library' );
			return false;
		}

	} else
	if ( url.protocol == 'sockjs:' ) {
		if ( 'function' != typeof SockJS ) 
			return undefined;

		var sockUrl = "http://"+url.hostname;
		if ( url.port ) 
		    sockUrl += ':'+url.port;

		sockUrl += url.pathname;

		

		listener = new Connection ( options );
		listener.name = urlStr;

		listener.reconnect = function () {
			console.log ("SockJS Reconnect", sockUrl );
			var sock = new SockJS ( sockUrl );
			listener.attachSockJSClient ( sock, url.query.path );
		}
		
	}


	if ( listener && listener.reconnect ) {
		listener.pull ();
		listener.reconnect();
		listener.attach();

		return listener;
	}

	return undefined;
}



var Http = require('http');
var Https = require('https');
var fs = require('fs');

var extend = require('util')._extend;

var Url = require('url');

Horten.Server = function ( options ) {
	var server = this;

	options = options || {};


	if ( options.url ) {
		if ( 'string' == typeof options.url )
			options.url = urlParse ( options.url );

		options.port = options.url.port;
		options.hostname = options.url.hostname;
		options.prefix = options.prefix || options.url.pathname;
	}



	var prefix = options.prefix || '/';

	if ( prefix.charAt(0) != '/' )
		prefix = '/'+prefix;

	if ( prefix.charAt(prefix.length-1) != '/' )
		prefix += '/';

	var horten = options.horten || Horten.instance();
	server.log = horten.log;

	options.path = Path( options.path );
	var localPath = options.path;

	server.url = {
		hostname: options.hostname || 'localhost',
		port: options.port || '',
		pathname: prefix
	};

	this.clientJSUrl = Url.format ( extend ( { protocol: 'http', search: '?js' }, server.url ) );


	

	var listener = new Listener ( {
		path: options.path,
		horten: options.horten
	} );

	/* Default authorization function. */
	var authorize = function ( request, callback ) {
		//server.log ( "AUTH", request.HortenPath );
		callback( true );
	}

	/* Clean up what comes back from user-supplied authorization
	callbacks. */
	function parseAuthReturn ( auth ) {
		if ( !auth ) {
			auth = {
				'deny': true,
				'setFlags': 0
			};
		}

		return auth;
	}

	/* Build the client JS. */
	var clientIncludes = {
		'sockJS': options.minify ? '../ext/sockjs-0.3.min.js' : '../ext/sockjs-0.3.js', 
		'horten': 'horten-client.js'
	};

	for ( var k in clientIncludes ) {
		clientIncludes[k] = fs.readFileSync( 
			require('path').join( __dirname, clientIncludes[k] ),
			'utf8' 
		);
	}


	function clientJS ( path, url ) {
		var urls = [];
		var options = {};
		var ret = ';';

		
		var hostAndPrefix = server.url.hostname;
		if ( server.url.port )
			hostAndPrefix += ':'+server.url.port;

		hostAndPrefix += prefix;

		path = path.translate ( localPath );
		path = path.string.substr( 1 );

		urls.push( 'ws://' + hostAndPrefix + path );
		urls.push( 'sockjs://' + hostAndPrefix + "__sockJS?path=/" + path );
		urls.push( 'http://' + hostAndPrefix + path );

		var name = 'HortenRemote',
			funcName = "__Horten"+parseInt(Math.random()*10000000);

		var js = ';';
		js += "function "+funcName+"(){\n";
		js += "\tvar client=H.Client("+JSON.stringify(urls)+","+JSON.stringify(options)+");\n";
		//js += '\tclient.pull();\n';
		//js += '\tconsole.log("CLIENT",client);';
		js += name+'=client;\n';
		js += '};\n';
		js += "if(window.attachEvent){\n\twindow.attachEvent('onload',"+funcName+");\n";
		js += "}else{\n\tif(window.onload){\n\t\tvar cur=window.onload,newonload=function(){\n\t\t\t";
		js += "cur();\n\t\t\t"+funcName+"()\n;};window.onload=newonload;";
		js += "}else{window.onload="+funcName+";};};";

		return js;
	}



	function httpResponse ( req, res, path, auth ) 
	{
		var that = this;

		//res.writeHead( "X-Poowered-By: Horten" );

		if ( auth.deny ) {
			res.writeHead ( auth.statusCode || 403, auth.statusText || 'Forbidden' );
			res.end ();
			return true;
		}

		var url = urlParse( req.url, true, true );
		if ( url.query.js != undefined ) {
			res.writeHead(200, {
				"Content-Type": "text/javascript"
			});
			res.write ( clientIncludes.sockJS );
			res.write ( clientIncludes.horten );
			res.end( clientJS ( path, url ) );
			return true;
		}
		

		// Send horten a fake listener object so that there will
		// be something to log in Horten.
		var fakeListener = {
			name: 'http('+req.connection.remoteAddress+')'
		}
		
		var value;
		switch ( req.method ) {
			case 'POST':
				// Here is top notch security!
				if ( auth.readOnly ) {
					res.writeHead ( 403, "Write disallowed" );
					res.end ();
					return true;
				}

				var json = '';
				req.setEncoding('utf8');
				req.on('data', function ( data ) {
					json += data;
				});
				req.on('end', function ( ) {
					try {
						value = JSON.parse ( json );
					} catch ( e ) {
						res.writeHead( 400, "Invalid POST JSON" );
						res.end ();
						return;
					}
					
					if ( path.set ( value, null, auth.setFlags, fakeListener ) ) {
						res.writeHead( 205 );
						res.end ();
					} else {
						res.writeHead( 204 );
						res.end ();
					}
				});
			break;


			case 'GET':
			default:
				value = path.get ();

				var body = value == null ? 'null' : JSON.stringify ( value, null, true );

				res.writeHead(200, {
					'Content-Length': body ? body.length : 0,
					"Content-Type": "text/javascript"
				});
				res.end( body );
			break;
		}

		return true;
	}


	//
	//	Flash socket policy server
	//

	var flashPolicyServer;
	this.listenFlashPolicy = function ( domains ) {

		if ( flashPolicyServer ) {
			throw new Error ( "Flash Policy server already open" );
		}

		if ( 'string' == typeof domains ) {
			domains = [ domains ];
		} else if ( !Array.isArray ( domains ) ) {
			domains = [ options.hostname ]
		}

		if ( !server.url.port ) {
			throw new Error ( "Port not specified" );
		}

		domains = domains.map( function ( domain ) { 
			return '\t<allow-access-from domain="'+domain+'"" to-ports="'+server.url.port+'"/>\n'
		});

		var policy = '<?xml version="1.0"?>\n'
			+ '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n'+
			+ '<cross-domain-policy>\n'+
			+ domains.join('')
			+ '</cross-domain-policy>';

		try {
			flashPolicyServer = require('net').createServer( function (socket) {
				socket.write( policy );
				socket.end();
			});
			flashPolicyServer.listen(843);
		} catch ( e ) {
			throw new Error ( "Couldn't listen to port 843 ( try sudo )" );
		}
	}

	
	function localPathFromRequest ( req ) {
		var url = urlParse( req.url );
		var path = url.pathname;

		if ( !prefix )
			return Path(path);

		if ( path.substr( 0, prefix.length ) != prefix )
			return false;

		var ret = localPath.append ( path.substr( prefix.length ) ); 
		
		return ret;
	}

	//
	//	Internal HTTP server.
	//
	var httpServer;
	this.listenHttp = function ( onPort ) {
		if ( httpServer ) {
			throw new Error ( 'http server already open' );
		}

		httpServer = require('http').createServer();

		httpServer.on('request', function ( req, res ) {
			var path = localPathFromRequest ( req );

			if ( !path )
				return false;

			req.HortenPath = path;

			authorize( req, function ( auth ) {
				httpResponse ( req, res, path, auth );
			});
		});

		//this.listenToWebSocket( httpServer );
		this.listenToUpgrade( httpServer );

		// Figure out port.
		if ( server.url.port && onPort && onPort != server.url.port ) {
			throw new Error ( 'Mismatch between specified port and options.port' );
		}

		var port = onPort || server.url.port || ( !!options.https ? 443 : 80 );
		if ( !server.url.port )
			server.url.port = port;

		server.log ( 'http', "listen", port );
		httpServer.listen ( port );

		return httpServer;
	}

	this.listenHttps = function ( options ) {
		
	}

	this.listenHSS = function ( port ) {
		var server = require('net').createServer( function (socket) {
			console.log ( "Connected" );

			socket.on('end', function () {
				listener.remove();
				console.log ( "Disconnected" );
			});

			var listener = new Connection ( {
				path: options.path
			});
			listener.attach_hss ( socket );
			
			//socket.end();
		});

		server.listen( port );
	}

	var sockJS;

	function getSockJS (  )
	{
		if ( sockJS )
			return sockJS;


		var sockJSPrefix = '__sockJS';
		var server = require('sockjs').createServer({ prefix: prefix+sockJSPrefix });
		var middleware = server.middleware (  );

		sockJS = {
			server: server,
			prefix: sockJSPrefix,
			middleware: middleware
		};

		server.on('connection', function ( sockJSConn ) {
			console.log ( "Waiting for guffman", sockJSConn );
			var listener = new Connection ( {
				attach: false
			});
			listener.waitForSockJSToSendPath ( sockJSConn, function ( path ) {

				var req = {
					path: path,
					debug: true
				};

				authorize ( req, function ( auth ) {

					if ( auth.deny ) {
						sockJSConn.close();
						return;
					}

					console.log ( "Sock authorized" );
					var handshake = {
						'hello': true
					};
					sockJSConn.write( JSON.stringify ( handshake ) );

					listener.setPath( path );
					listener.attachSockJSServer ( sockJSConn );
				} );
			} );
		});

		return sockJS;
	}


	/*
		Dead code for connection with Worlize/websocket-node, which is
		nice and all, but einaros/ws is looser and more flexible.
	*/
	this.listenToWebSocket = function ( httpServer ) {
		var wsServer = new (require('websocket').server) ( {
			httpServer: httpServer
		});
		wsServer.on('request', function ( req ) {
			var path = localPathFromRequest( req.httpRequest );
			if ( !path ) {
				req.reject();
				log( 'websocket', req.origin, "Rejected ( No Path )" );
				return;
			}
			// Fill in req with all the variables it expects.
			req.HortenPath = path;

			authorize ( req, function ( auth ) {
				if ( !auth || auth.deny ) {
					req.reject()
					log( 'websocket', "Rejected", req.origin, auth );
					return;
				}

				var websocket = req.accept( );

				var connection = new Connection ( {
					path: path
				});
				connection.name = "websocket("+req.origin+")";
				connection.attach_websocket ( websocket );
				connection.log = log;
			});

		} );

		
	}

	this.listenToUpgrade = function ( httpServer, allowMultiple ) {

		var wsServer = new (require('ws').Server) ( {
			noServer: true
		});

		function abortConnection(socket, code, name) {
			try {
				var response = [
					'HTTP/1.1 ' + code + ' ' + name,
					'Content-type: text/html'
				];
				socket.write(response.concat('', '').join('\r\n'));
			}
			catch (e) { /* ignore errors - we've aborted this connection */ }
			finally {
				// ensure that an early aborted connection is shut down completely
				try { socket.destroy(); } catch (e) {}
			}
		}

		httpServer.on('upgrade', function ( req, socket, upgradeHead ) {
			path = localPathFromRequest( req );
			
			if ( !path ) { 
				// The request does not start with prefix, so is none of our 
				// business. By default, drop it. If `allowMultiple` is specified,
				// don't do anything so the next on('upgrade') can handle it.
				// Note that if nothing else is listening to `upgrade`, the
				// connection will hang, which ain't good.

				if ( allowMultiple )
					return;

				// Kill the request.
				abortConnection( socket, 404, 'Not Found' );
				return;
			}

			// Fill in req with all the variables it expects.
			req.HortenPath = path;

			authorize ( req, function ( auth ) {
				auth = parseAuthReturn( auth );

				if ( auth.deny ) {
					abortConnection( socket, auth.statusCode || 403, auth.statusText || 'Forbidden' );
					return;
				}

				wsServer.handleUpgrade( req, socket, upgradeHead, function ( wsConnection ) {
					var connection = new Connection ( {
						path: path
					});
					connection.name = "ws("+socket.remoteAddress+")";

					connection.attach_ws ( wsConnection );
				} );
			});
		});
	}




	this.middleware = function ( ) {
		getSockJS();
		var middleware = function( req, res, next ) {
			path = localPathFromRequest( req );
			
			if ( !path ) { 
				next(); 
				return;
			}

			if ( sockJS && path.startsWith ( sockJS.prefix ) ) {
				console.log("SockJS returning middleware" );
				return sockJS.middleware.apply( this, arguments );
			}

			req.HortenPath = path;

			authorize( req, function ( auth ) {
				httpResponse ( req, res, path, auth );
			});
		};

		middleware.upgrade = function ( req, res, upgradeHead )
		{
			console.log('got upgrade');
		}
		
		return middleware;
	}

	this.close = function () {
		if ( flashPolicyServer ) {
			flashPolicyServer.close();
			flashPolicyServer = null;
		}


	}

	return server;


}



/*
	Dead code for connection with Worlize/websocket-node, which is
	nice and all, but einaros/ws is looser and more flexible.
*/
/*
Connection.prototype.attach_websocket = function ( websocket ) 
{
	var connection = this;

	connection.websocket = websocket;

	websocket.on('message', function(message) {
		connection.onRemoteData ( message.utf8Data );
	});
	
	websocket.on('close', function () {
		if ( connection.log )
			connection.log( connection.name, 'closed');

		connection.onRemoteClose ();
	});

	this.readyToSend = function () {
		return websocket;
	}

	this.send = function ( msg ) {
		if ( !websocket )
			return false;

		msg = JSON.stringify ( msg );
		websocket.sendUTF ( msg );
		return true;
	}

	this._close = function () {
		websocket.close ();
		websocket = null;
	}


	this.attach ();
}
*/


/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
Connection.prototype.attach_ws = function ( connection ) 
{
	var that = this;

	this.wsn = connection;

	//console.log ( connection );

	connection.on('message', function(message) {
		that.onRemoteData ( message );
	});
	
	connection.on('close', function () {
		that.onRemoteClose ();
	});

	this.readyToSend = function () {
		return connection;
	}

	this.send = function ( msg ) {
		if ( !connection )
			return false;

		msg = JSON.stringify ( msg );
		if ( that.debug )
			console.log ( that.name, "SEND", msg );

		connection.send ( msg );
		return true;
	}

	this._close = function () {
		connection.close ();
		connection = null;
	}


	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}



Connection.prototype.waitForSockJSToSendPath = function ( conn, callback )
{

	var that = this,
	timeOut = setTimeout ( this._close, 2000 );

	this._close = function () {
		console.log ( this.name, 'Closed SockJS before getting path' );
		conn.close ();
	}

	conn.once('data',function ( msg ) {
		console.log ( "SOCK initial", msg );
		try {
			msg = JSON.parse ( msg );
		} catch ( e ) {
			that._close();
			return;
		}

		if ( !msg.path ) {
			console.log( "Didn't get path from remote" );
			that._close();
		}

		var path = Path( msg.path );

		console.log ( "SOCK path", path );
		callback ( path );

	});
}


Connection.prototype.attachSockJSServer = function ( connection ) 
{
	var that = this;

	this.wsn = connection;

	//console.log ( connection );

	connection.on('data', function(message) {
		that.onRemoteData ( message );
	});
	
	connection.on('close', function () {
		console.log ( that.name, 'Closed incoming connection' );
		that.onRemoteClose ();
	});

	this.readyToSend = function () {
		return connection;
	}

	this.send = function ( msg ) {
		if ( !connection )
			return false;

		msg = JSON.stringify ( msg );
		if ( that.debug )
			console.log ( that.name, "SEND", msg );

		connection.write ( msg );
		return true;
	}

	this._close = function () {
		connection.close ();
		connection = null;
	}


	this.attach ();
	console.log ( that.name, 'Accepted SockJS connection' );
}

/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
Connection.prototype.attach_hss = function ( socket ) 
{
	var that = this;

	that.hssSocket = socket;
	that.name = "hss:"+socket.remoteAddress;

	
	socket.on('end', function () {
		that.onRemoteClose ();
	});

	this.readyToSend = function () {
		return !!socket;
	}

	this.send = function ( msg ) {
		console.log ( that.name, 'Writing hss' );
		var content = new Buffer( JSON.stringify( msg ) );
		var header = new Buffer( 4 );
		header.writeUInt32BE( content.length, 0 );
		socket.write( Buffer.concat( [ header, content ] ) );

		return true;
	}

	this._close = function () {
		socket.destroy();
		socket = null;
	}


	this.attach ();
	console.log ( that.name, 'Accepted HSS connection' );

	this.push();
}



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
	
	if ( config.server && config.server.port ) { 
		if ( !config.server.host )
			config.server.host = "localhost";

		this.name = 'osc://:'+config.server.port;
		console.log ( "listening to osc", config.server.port );

		this.server = new osc.Server ( config.server.port, config.server.host );
		this.server.on ( "message", function ( decoded, rinfo ) {
			
			var path = decoded[0];

			//console.log ( 'decoded', decoded );
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

	if ( config.client && config.client.host && config.client.port ) {
		this.addClient ( config.client.host, config.client.port, false );
	}
	
	this.close = function () {
		this.remove()
			
		if ( this.server ) {
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

HortenOSC.prototype.onData = function ( value, path, method, origin ) {
	if ( !this.clients )
		return;

	var that = this;
	var pathStr = path.string;

	if ( this.treatAsArray ) {
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

if (typeof exports !== 'undefined' && typeof module !== 'undefined' && module.exports ) {
	exports = module.exports = Horten;
} else {
	this.ProjectName = ProjectName;
}