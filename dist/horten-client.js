/**
 * horten v0.3.0 - 2013-03-14
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

Path.prototype.toString = function () {
	return this.string;
}
var nextTick;
if ( process && process['nextTick'] ) {
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
	if ( !original && d != null && 'object' == typeof d ) {
		
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
		
		return clone ( d );
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
		var path = Path ( listener._attachedToPath );
		var m = this.getMeta ( path, false );
		
		if ( m ) {
			deleteFromArray ( 'lp' );
			deleteFromArray ( 'lo' );
		}
		
		function deleteFromArray ( arrayName ) {
			if ( m[arrayName] ) {
				var ind = m[arrayName].indexOf ( listener );
				if ( ind != -1 )
					m[arrayName].splice( ind, 1 );
				
				if ( m[arrayName].length == 0 )
					delete m[arrayName];
			}
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
		this.horten = Horten.instance ();	
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

	if ( this.horten )
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
	console.log ( 'l', path, value );
	if ( 'function' == typeof this.callback ) {
		this.callback( path, value, method, origin );
	}
	// Do what you will be here.
}
if ( 'function' == typeof require && 'object' == typeof exports ) {
	//	Stupid check to see if we're in a node environment,
	//	as opposed to the browser.
	var WebSocket = require('websocket');
	var WebSocketClient = WebSocket.client;

	exports.jsFile = __filename;
} 


function HortenWebSocket ( config )
{
	this.primitive = true;
	// Magic object
	this.FILL_DATA = {};

	this.keepAlive = config && !!config;

	if ( config != null ) {
		Listener.call ( this, config, this.onData );
		this.catchAll = true;
		this.attach ();
	}
}

HortenWebSocket.prototype = new Listener ( null );

HortenWebSocket.connect = function ( connectOpts ) {
	if ( 'function' == typeof WebSocket && connectOpts.WebSocket ) {
		return new HortenWebSocketClient ( connectOpts.WebSocket );
	} else if ( 'function' == typeof SockJS && connectOpts.SockJS ) {
		return new HortenSockJSClient ( connectOpts.SockJS, connectOpts.path )
	} else {
		console.log( "Nothing to connect with", SockJS)
	}
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
	path = Horten.pathString( path );

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
	path = Horten.pathString ( path );
	

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

HortenWebSocket.prototype.onData = function ( path, value )
{
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
			var localPath = this.localToGlobalPath( remotePath );
			
			Horten.flattenObject( value, localPath, set );
		}
		
		console.log ( "GOT MESG set", set );

		this.horten.setMultiple ( set, this );
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
	
	var somethingToSend = false;
	
	for ( var remotePath in this._pushData ) {
		
		somethingToSend = true;
		
		if ( this._pushData[ remotePath ] == this.FILL_DATA ) {
			var localPath = this.localToGlobalPath ( remotePath );
			this._pushData[ remotePath ] = this.horten.get ( localPath );
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

	

	remotePath = Horten.pathString ( remotePath );
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
