/**
 * horten v0.3.0 - 2013-05-09
 * Experimental shared-state communication framework.
 *
 * Copyright (c) 2013 koopero
 * Licensed MIT
 */
Horten.Path = Path;

function Path ( parse ) {

  	// If the input given is already a parsed path,
 	// return it unchanged.
 	if ( parse && parse.constructor == Path ) {
 		return parse;
 	}
  
  	// Can be called as either Path or new Path
 	if ( this.constructor != Path ) {
 		return new Path ( parse );
 	}
 	
 	// This parsing works, but could use some optimization...
 	var pathStr, pathArr;
 	if ( parse == null || parse == undefined ) {
 		parse = '/';
	} else if ( Array.isArray ( parse ) ) {
    	parse = parse.join('/');
	} else {
		parse = String ( parse );
	}
	
	// ... in fact, this is downright clunky.		
	pathArr = parse.split('/').filter ( function ( el ) {
		return ( ( typeof el == 'string' ) && el.length > 0 );
	} );
	
	if ( pathArr.length == 0 ) {
		pathStr = '/';
	} else {
		pathStr = '/'+pathArr.join( '/' )+'/';
	}
 	
 	this.string = pathStr;
 	this.array = pathArr;
 	this.length = pathArr.length;
}
 
Path.prototype.getSegment = function ( i ) {
	return this.array[i];
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
	Same as Horten.prototype.get, except uses the default Horten
	instance as available from Horten.instance()
*/
Horten.get = function ( path, original ) {
	return Horten.instance().get ( path, original );
	
}

/**
	Enum of flags to be used with Horten.prototype.set.
	
*/
Horten.setFlags = {
	keepTopology: 	2,
	forceListeners: 4,
	replace:		8
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
		p = path.getSegment( i );
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
		p = path.getSegment( i );
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
				console.log ( origin ? origin.name : '<anon>', path, value ); 
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

/** 
	Same as Horten.prototype.set, except uses the default Horten
	instance as available from Horten.instance()
*/
Horten.set = function ( value, path, flags, origin ) {
	return Horten.instance().set ( value, path, flags, origin );
}

/**
	Returns the meta object at a given path. If the create parameter is
	true, a meta object will be created and its existence guaranteed. If
	not, undefined will be return if the meta path does not exist.
*/
Horten.prototype.getMeta = function ( path, create ) {
	path = Path ( path );
	
	var m = this.meta;
	var i = 0, p;
	
	while ( p = path.getSegment ( i ) ) {
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
Horten.prototype.attachListener = function ( listener ) {
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
Horten.prototype.removeListener = function ( listener ) {
	if ( listener.horten && listener.horten != this ) {
		throw 'Trying to remove listener attached to different Horten instance';
	}

	if ( listener._attachedToPath ) {

		console.log ( "Removing listener from ", listener._attachedToPath );

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
Horten.prototype.flush = function () {
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
		p = path.getSegment( i );
		
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
		p = path.getSegment( i );
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
	if ( path == undefined || path == null )
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
HortenMySQL.prototype = new Horten.Listener ( false );
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

	if ( config.history ) {
		if ( config.timeOffset )
			this.timeOffset = -Date.parse ( config.timeOffset );
		else
			this.timeOffset = 0;

		if ( config.timeQuant )
			this.timeQuant = parseFloat ( config.quantizeTime );
		else
			this.timeQuant = 1000;

		this.history = true;
	} else {
		this.history = false;
	}

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
		var connection;

		if ( 'object' != typeof config.connection || config.connection == null ) {
			// Need something!
			throw 'Connection details not specified';
		} else if ( config.connection._protocol ) {
			// A flaky way of determining if the connection passed in config
			// is a real connection, as oppose to the configuration for one.
			connection = config.connection
		} else {
			connection = require ( 'mysql' ).createConnection ( connection );
		}

		connection.on('error', function ( err ) {
			console.log ( that.name, 'Mysql Error', JSON.stringify ( err ) );
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
				console.log ( "BAD CONNECTION!");
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
					console.log ( err );
					throw 'SQL error creating tables.';
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
if ( 'function' == typeof require && 'object' == typeof exports ) {
	//	Stupid check to see if we're in a node environment,
	//	as opposed to the browser.
	//var WebSocket = require('websocket');
	var WebSocketClient = require('websocket').client;

	exports.jsFile = __filename;
}

Horten.WebSocket = HortenWebSocket;
function HortenWebSocket ( config )
{
	Listener.call ( this, config );


	this.primitive = true;
	// Magic object
	this.FILL_DATA = {};

	if ( config ) {
		this.keepAlive = config && !!config.keepAlive;
		this.attach ();
	}
}

HortenWebSocket.prototype = new Listener ( null );

HortenWebSocket.connect = function ( connectOpts ) {
	console.log ( "Trying connect with", connectOpts, WebSocket );
	var ret;

	if ( 'function' == typeof WebSocket && connectOpts.WebSocket ) {
		ret = new HortenWebSocketClient ( connectOpts.WebSocket );
		ret.attach();
	} else if ( 'function' == typeof SockJS && connectOpts.SockJS ) {
		ret = new HortenSockJSClient ( connectOpts.SockJS, connectOpts.path );
		ret.attach();
	} else {
		console.log( "Nothing to connect with" );
	}

	return ret;
}


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
HortenWebSocket.prototype.pull = function ( path )
{
	path = Path( path ).string;

	if ( !this._pullPaths )
		this._pullPaths = [];
	

	if ( this._pullPaths.indexOf ( path ) == -1 )
		this._pullPaths.push ( path );
	
	this._pull ();
};

HortenWebSocket.prototype._pull = function () 
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




HortenWebSocket.prototype.push = function ( path )
{
	path = Path ( path );
	

	if ( !this._pushData )
		this._pushData = {};

	this._pushData[path] = this.FILL_DATA;
	this._push();
}

HortenWebSocket.prototype.readyToSend = function ()
{
	return false;
}

/**
 * Called when the other end of the connection drops
 * unexpectedly.
 */

HortenWebSocket.prototype.onremoteclose = function ()
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

HortenWebSocket.prototype.onData = function ( value, path )
{
	console.log ( 'HWS ONDATA', value, path);

	if ( !this._pushData )
		this._pushData = {};
	
	this._pushData[path] = value;

	// Should delay push here
	this._push();
}

HortenWebSocket.prototype.onRemoteData = function ( msg ) {
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
		
		console.log ( "GOT MESG set", set );

	}
	
	if ( msg.get ) {
		this.push( msg.get );
	}
}

/** Close the connection with no hope of reopening */
HortenWebSocket.prototype.close = function ()
{
	this.remove();
	this.keepAlive = false;
	
	if ( 'function' == typeof this._close ) {
		this._close();
	}
};

HortenWebSocket.prototype._push = function ()
{
	if ( !this._pushData )
		return;
	
	

	if ( !this.readyToSend() ) {
		return;
	}
	
	console.log ( "HWS PUSH", this._pushData );

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

/**
 * 
 */
HortenWebSocket.prototype.attachWebSocket = function ( websocket ) {
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
		//console.log ( that.name, 'onmessage', msg.data );
		that.onRemoteData ( msg.data );		
	};
	
	websocket.onclose = function ()
	{
		console.log ( that.name, "onclose" );
		that.onremoteclose ();
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

/**
 * 
 */
HortenWebSocket.prototype.attachWebSocketNodeClient = function ( client ) {
	var that = this;

	client.on('connectFailed', function ( error ) {
		console.log ( that.name, 'Connecting failed' );
		that.onremoteclose ()
	});

	client.on('connect', function ( conn ) {
		console.log ( that.name, 'Connected ' );
		that.wsn = conn;

		conn.on('close', function () {
			that.onremoteclose ();
		});

		conn.on('message', function ( message ) {
			if ( message.type != 'utf8' ) {
				console.log ( that.name, 'Not UTF8 from remote' );
				return;
			}
			that.onRemoteData ( message.utf8Data );
		});

		that._push ();
		that._pull ();
	});

	this.readyToSend = function () {
		return that.wsn && that.wsn.connected;
	}

	this.send = function ( msg ) {
		if ( !that.wsn || !that.wsn.connected )
			return false;

		that.wsn.sendUTF ( JSON.stringify ( msg ) );
		return true;
	}
}



/** 
 * Connect to a remote WebSocket server at a given url.
 * 
 * @param url
 */
function HortenWebSocketClient ( url, config ) 
{
	var that = this;
	HortenWebSocket.call( this, config );

	that.name = url;

	var client;

	if ( 'function' == typeof WebSocket ) {
		this.reconnect = function () {
			client = new WebSocket ( url, 'horten-protocol' );
			this.attachWebSocket ( client );
		}

	} else if ( 'function' == typeof WebSocketClient ) {
		this.reconnect = function () {
			client = new WebSocketClient ()
			client.connect ( url, 'horten-protocol' );
			this.attachWebSocketNodeClient ( client );
		}

	} else {
		throw new Error ( 'No WebSocket library' );
	}

	this.primitive = true;
	this.attach();
	this.reconnect();
	

}

HortenWebSocketClient.prototype = new HortenWebSocket ( null );

/** 
 * Connect to a remote WebSocket server at a given url.
 * 
 * @param url
 */
function HortenSockJSClient ( url, remotePath, config ) 
{
	var that = this;
	HortenWebSocket.call( this, config );

	

	remotePath = Path ( remotePath ).string;
	that.name = url + '/'+remotePath;

	this.reconnect = function () {
		var sock = new SockJS ( url );
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
				that.onremoteclose ()
				return;
			}

			if ( msg.path == remotePath ) {
				that.attachWebSocket ( sock );
				console.log ( that.name, "Connected SockJS" );

				that.onRemoteData ( msg );
			} else {
				console.log ( that.name, "Didn't get path handshake from server" );
				sock.close ();
				that.onremoteclose ();
			}
		}

		sock.onclose = function () {
			console.log ( that.name, "Didn't get path handshake from server" );
			that.onremoteclose ();
		}
	}

	this.reconnect ();

	this.attach ( );
}

HortenSockJSClient.prototype = new HortenWebSocket ( null );

var WebSocketServer = require('websocket').server;
var Http = require('http');
var Https = require('https');
var fs = require('fs');

var Url = require('url');


/**
 * Accept a connection for a remote WebSocket Client.
 * @param connection
 */
HortenWebSocketServer = function ( request, subPath, config, auth ) 
{
	var that = this;

	var connection = request.accept('horten-protocol', request.origin );

	HortenWebSocket.call ( this, config );

	this.wsn = connection;
	
	if ( subPath )
		this.path = Path ( Path ( this.path ) + Path ( subPath ) );

	this.name = 'ws://'+connection.remoteAddress;
		
	connection.on('error', function (error) {
		console.log ( "Connection error " +JSON.stringify(error) );
	});
		
	connection.on('message', function(message) {
		if ( message.type != 'utf8' ) {
			console.log ( that.name, 'Not UTF8 from remote' );
			return;
		}
		that.onRemoteData ( message.utf8Data );
    });
	
	connection.on('close', function () {
		console.log ( that.name, 'Closed incoming connection' );
		that.close ();
	});

	this.readyToSend = function () {
		return that.wsn && that.wsn.connected;
	}

	this.send = function ( msg ) {
		if ( !that.wsn || !that.wsn.connected )
			return false;

		that.wsn.sendUTF ( JSON.stringify ( msg ) );
		return true;
	}

	this._close = function () {
		connection.close ();
	}


	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}

HortenWebSocketServer.prototype = new HortenWebSocket ( null );


HortenSockJSServer = function ( conn, subPath, config, auth ) 
{
	var that = this;

	HortenWebSocket.call ( this, config );

	if ( subPath )
		this.path = Path ( this.path + subPath );

	this.name = 'sjs://'+conn.remoteAddress;

	console.log ( that.name, "Connected initial");

	conn.on('data', function ( message ) {
		that.onRemoteData ( message );
	} )

	conn.on('close', function ( ) {
		that.onremoteclose();
	} );

	this.readyToSend = function () {
		return conn.readyState == 1;
	}

	this.send = function ( msg ) {
		if ( conn.readyState != 1 ) 
			return false;

		conn.write ( JSON.stringify ( msg ) );

		return true;
	}

	this.attach ();
	console.log ( that.name, 'Accepted connection' );
}

HortenSockJSServer.prototype = new HortenWebSocket ( null );



Horten.Server = HortenServer;
function HortenServer ( config ) {

	var that = this;

	if ( 'string' == typeof config ) {
		config = {
			path: config
		}
	} else if ( !config ) {
		config = {};
	}

	this.config = config;

	if ( 'function' == typeof config.auth )
		this.authRequest = config.auth;

	// Create a default listener, to take care of path translations and
	// default horten
	this.listener = new Listener ( config );
	
	this.horten = this.listener.horten;
	this.listener.remove();
	

	var port = this.port = parseInt( config.port ) || 8000;

	//
	//	
	//
	var connectOpts = {};
	var hostname = config.hostname || '127.0.0.1';




	//
	//	
	//
	var createHttpServer = function ( port ) {
		var server = config.https ? Https.createServer : Http.createServer;
		// Create HTTP server
		var server = server ( function(request, response) {
			that.authRequest ( request, function ( auth ) {
				that.processHttpRequest ( request, response, auth ); 
			} );
		});

		server.listen ( port );

		return server;
	}

	that.httpServer = createHttpServer( port );

	connectOpts.http = Url.format( {
		protocol: 	'http', 
		hostname: 	hostname,
		port: 		port
	} );

	var jsFiles = [	]

	if ( config.sockJS ) {
		jsFiles.push( 'ext/sockjs-0.3.min.js' );	
		that.sockJSServer = createHttpServer( config.sockJSPort );

		that.sockJSPrefix = config.sockJSPrefix || '__sockJS';

		if ( '/' != that.sockJSPrefix.substr ( 0, 1 ) )
			that.sockJSPrefix = '/' + that.sockJSPrefix;


		var sockjs = require ( 'sockjs' ).createServer();
		sockjs.on('connection', function ( conn ) {
			var onInitalData = function ( data ) {
				try {
					data = JSON.parse ( data );
				} catch ( e ){
					console.log ( 'sjs://'+conn.remoteAddress, 'Bad JSON in path setting' );
					conn.close ( 400, 'Bad JSON in path setting' );
				}

				if ( data.path ) {
					that.authRequest ( {
						remoteAddress: conn.remoteAddress,
						headers: conn.headers,
						path: data.path
					}, 
					function ( auth ) {
						if ( !auth ) {
							console.log ( 'Rejected SockJS request' );
							conn.close ( 403, 'Not authorized' );
							return;
						}
						conn.write ( JSON.stringify ( {'path': data.path }));
						var listener = new HortenSockJSServer ( conn, data.path, that.config, auth );
					})
				} else {
					console.log ( 'sjs://'+conn.remoteAddress, "Didn't send path", data );
					conn.close ( 400, 'Must send path' );
				}
			};
			conn.once( 'data', onInitalData );
		});

		sockjs.installHandlers( that.sockJSServer, {prefix:that.sockJSPrefix});

		connectOpts.SockJS = Url.format( {
			protocol: 	'http', 
			hostname: 	hostname,
			port: 		config.sockJSPort ,
			pathname: 	that.sockJSPrefix,
		} );


	} 


	if ( config.websocket ) {

		// Add WebSocket server
		this.wsServer = new WebSocketServer({
		    httpServer: this.httpServer
		});

		// WebSocket server
		this.wsServer.on('request', function(req) {

			if ( req.requestedProtocols.indexOf ( 'horten-protocol' ) == -1 ) {
				console.log ( 'ws://'+req.remoteAddress, 'Rejected unknown websocket sub-protocol' );
				req.reject ( 406, 'Improper sub-protocol');
				return;
			}

			that.authRequest ( req.httpRequest, function ( auth ) {
				if ( !auth ) {
					console.log ( 'ws://'+req.remoteAddress, 'Rejected websocket request' );
					req.reject ();
					return;
				}
				var listener = new HortenWebSocketServer ( req, req.httpRequest.url, that.config, auth );
			} );
		});

		connectOpts.WebSocket = Url.format( {
			protocol: 	'ws', 
			slashes: 	true, 
			hostname: 	hostname,
			port: 		port,
			pathname:   '/', 
		} );
	}


	//
	//	Build magic JS
	//




	jsFiles.push( 'horten-client.js' );

	//console.log( Path.join( __dirname, 'ext/sockjs-0.3.min.js') );

	this.clientJSIncludes = '';

	for ( var i = 0; i < jsFiles.length; i++ ) {
		var jsFile = jsFiles[i];
		this.clientJSIncludes += fs.readFileSync( require('path').join( __dirname, jsFile ), 'utf8' );
	}

	

	this.clientJS = function ( path ) {
		path = Path ( path ).string.substr ( 1 );

		var opts = {
			path:path
		};

		opts.keepAlive = true;

		for ( var k in connectOpts ) {
			var url = Url.parse ( connectOpts[k] );

			if ( k != 'SockJS' )
				url.pathname += path;

			opts[k] = Url.format( url );
		}

		var js = 	"function __hortenConnect () { "+
					"HortenRemote=H.WebSocket.connect(" +JSON.stringify( opts )+");"+
					"if ( HortenRemote ) { HortenRemote.attach();HortenRemote.pull(); };" +
					"}" +
					"if(window.attachEvent){window.attachEvent('onload', __hortenConnect );"+
					"} else { if(window.onload) { var curronload = window.onload; var newonload = function() {"+
					"curronload(); __hortenConnect(); }; window.onload = newonload;"+
    				"} else { window.onload = __hortenConnect; } }"

		return js
	}
	
}




HortenServer.prototype.authRequest = function ( request, callback ) {

	//console.log ( "AUTH", request );

	callback ( {} );
}


/** 
 * Response to an HTTP request. 
 * 
 * @param {ServerRequest} req  The http request
 * @param {ServerResponse} res The http response
 * @param {Boolean} auth Whether an actual response is authorized
 */
HortenServer.prototype.processHttpRequest = function ( req, res, auth ) 
{
	var that = this;

	if ( !auth ) {
		res.writeHead ( 403, "Not allowed" );
		res.end ();
	}

	var url  = req.url;
	url = Url.parse( url, true );

	var path = Path( url.pathname );

	if ( url.query.js != undefined && that.clientJS ) {


		res.writeHead(200, {
			"Content-Type": "text/javascript"
		});
		res.write ( that.clientJSIncludes );

		res.end( that.clientJS ( path ) );
		return;
	}

	path = that.listener.localToGlobalPath ( path );


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
				return;
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
				
				if ( that.horten.set ( value, path, fakeListener ) ) {
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
			value = that.horten.get ( path );
			var body = value == null ? 'null' : JSON.stringify ( value, null, true );

			res.writeHead(200, {
			  'Content-Length': body ? body.length : 0,
			  "Content-Type": "text/javascript"
			});
			res.end( body );
		break;
	}
}

HortenServer.prototype.close = function ()
{
	if ( this.httpServer ) {
		this.httpServer.close ();
	}
}




exports.server = HortenServer;
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
	
	if ( config.server && config.server.host && config.server.port ) { 
		this.name = 'osc://:'+config.server.port;

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