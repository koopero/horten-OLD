/*
	Get an appropriate 'nextTick' function.
*/
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

Horten.prototype.set = function ( value, path, origin, flags ) {
	// Make sure path is proper before doing anything.
	path = Path ( path );

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
		
		if ( d[p] == null || 'object' != typeof d[p] ) {
			if ( flags & Horten.setFlags.keepTopology ) {
				// If the path we're looking to set doesn't
				// exist, bail here if we're keeping topology.
				return false;
			}
			d = d[p] = {};
			touched = true;
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
		touched = merge ( value, d, m, '/', lp );
	} else {
		p = path.getSegment( i );
		m = m && m['_'] && m['_'][p];
		touched = set ( p, value, d, m, path.toString(), lp );
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
			if ( d[k] === undefined && ( flags & Horten.setFlags.keepTopology ) )
				continue;
		
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
			currentIsOb != newIsOb &&
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
	}
	
	function triggerObjectListeners ( listeners ) {
		for ( var i = 0; i < listeners.length; i ++ ) {
			var listener = listeners[i];
			
			if ( listener === origin )
				continue;
			
			listener._objectChange = {
				origin: origin
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
Horten.set = function ( value, path, origin, flags ) {
	return Horten.instance().set ( value, path, origin, flags );
}

/**
	Returns the meta object at a given path. If the create parameter is
	true, a meta object will be created and its existence guaranteed. If
	not, undefined will be return if the meta path does not exist.
*/
Horten.prototype.getMeta = function ( path, create ) {
	path = Path ( path );
	
	var m = this.meta;
	var i = 0;
	
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
		
		//	It would be nice to walk back through the meta tree, deleting
		//	empty meta objects as we go, but I don't feel like it right now.
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
						callback( undefined, path, 'delete', o.origin );
						
						if ( o.value !== undefined ) 
							callback ( o.value, path, 'set', o.origin );
					} else {
						callback ( o.value, path, 'set', o.origin );
					}
					
				}
			}
			
			if ( ob ) {
				callback ( that.get( listenerPath ), listenerPrefix, ob.method, ob.origin );
			}
		}
	}
	
	delete this._pendingListeners;
}

/** 
	Merge two objects together, using more or less the same rules as Horten.set, except
	without calling listeners and all that jazz.
**/

Horten.merge = function ( a, b, bPath ) 
{
	// TODO: Not implemented
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

Horten.flattenObject = function ( ob, path ) {
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
