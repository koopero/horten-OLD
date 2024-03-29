;var H = (function ( __global ) {
// UTILS
/* It won't hanlde half the shit require('url').parse will, but it'll work in a pinch. */
function urlParse ( url, parseQueryString )  {
	var urlReg = /^((\w+:)\/)?\/?((.*?)@)?(([^:\/\s]+)(:(\d+))?)(([^?#]*)(\?([^#]*))?)(#.*)?/
	var m = urlReg.exec( url );

	var ret = {};

	ret.protocol 	= m[2] || '';
	ret.slashes		= true;
	ret.auth		= m[4] || null;
	ret.host 		= m[5] || '';
	ret.port		= m[8] || null;
	ret.hostname	= m[6];
	ret.hash 		= m[13] || null;
	ret.search		= m[11];

	if ( parseQueryString && m[12] ) {
		var q 		= m[12].split('&');

		ret.query 	= {};
		for ( var i = 0; i < q.length; i ++ )  {
			var p 	= q[i].split('=');
			ret.query[p[0]]	= p[1] || '';
		}
		
	}

	ret.pathname	= m[10];
	ret.path		= m[9];
	ret.href 		= url;

	return ret;
}

// Right from the node source code!
// https://github.com/joyent/node/blob/master/lib/util.js
var inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

function instance () {
	return Horten.instance();
}


function nextTick( func ) {
	setTimeout( func, 1 );
} /**
 	Path
 
 	Defines a canonical Horten path. Horten paths are, in their string form,
 	represented as slash delimited lists of segments with leading and trailing
 	slashes. 
 	
 		/this/is/a/horten/path/
 		
 	Any character other than slash can be used in a path segment, although in
 	the future, Horten may be extended to perform special behaviour on segments
 	prefixed with dollar ($), so please avoid it. Also, it would be wise to
 	avoid anything you wouldn't put in a variable name.
 	
 		/$don't/do/this/ /while/it might work, it's sketchy/
 	
 	The Path constructor takes a single parameter, usually a string, an Array or
 	undefined, an returns a Path object with both an array and string representation
 	of the path. The string representation is cleaned up, in canonical form.
 	
 	Here are some examples of the parsing of paths:
 	
 		undefined 		=> /
 		null 			=> /
 		'foo'			=> /foo/
 		'foo/bar' 		=> /foo/bar/
 		[ 'foo', 2 ]	=> /foo/2/
 		[ 'foo/bar' ]	=> /foo/bar/
 		
 	Input values other than strings, arrays, null and undefined will be converted
 	to strings.
 	
 	All Horten functions such as set and get will use the Path constructor for
 	path parameters, so feel free to use string or arrays when calling Horten or
 	Listener functions. In fact, you may never need to use the Path function in
 	your code. 
 
 */
 
 
 
 
 function Path ( path ) {
   	// If the input given is already a pathd path,
  	// return it unchanged.
  	if ( path && arguments.length == 1 && path.constructor == Path ) {
  		return path;
  	}
 
   	// Can be called as either Path or new Path
  	if ( this.constructor != Path ) {
  		return new Path ( path );
  	}
 
  	var self = this;
 
  	self.string = '/';
  	self.length = 0;
  	parse( arguments );
 
  	function parse( token ) {
  		if ( token === null )
  			return;
 
  		var t = typeof token;
  		if ( t == 'object' ) {
  			var i = 0;
  			while ( token[i] !== undefined ) {
  				parse( token[i] );
  				i++;
  			}
  		} else if ( t == 'number' || t == 'boolean' ) {
  			append( String( token ) );
  		} else if ( t == 'string' ) {
  			parseString( token );
  		}
  	}
 
  	function parseString ( str ) {
  		var s = 0, e, l = str.length;
  		while ( s < l ) {
  			
  			if ( str[s] == '/' ) {
  				s++;
  				continue;
  			}
 
 			e = str.indexOf( '/', s );
 
 			if ( e == -1 )
 				e = str.length;
 
 			append( str.substr( s, e - s ) );
 			s = e + 1;
  		}
  	}
 
  	function append ( str ) {
  		self[self.length] = str;
 		self.length ++;
 		self.string += str + '/';
  	}
  	
  	return self;
 }
  
 Path.prototype.seg = function ( i ) {
 	return this.array[i];
 }
 
 
 //	--------------------
 //	Orthogonal Convience
 //	--------------------
 
 Path.prototype.set = function ( value, path, flags, origin, horten ) {
 	horten = horten || this.horten || instance();
 
 	if ( path == undefined )
 		return horten.set( value, this, flags, origin );
 
 	path = this.append ( path );
 
 	return horten.set ( value, path, flags, origin );
 }
 
 Path.prototype.get = function ( path, horten ) {
 	horten = horten || this.horten || instance();
 
 	if ( path == undefined )
 		return horten.get( this );
 
 	path = this.append ( path );
 
 	return horten.get ( path );	
 }
 
 
 Path.prototype.append = function ( postfix ) {
 	return Path(this.string + postfix);
 }
 
 Path.prototype.slice = function ( i, length ) {
 	var 
 		self = this,
 		ret = new Path();
 
 	i = parseInt( i );
 	length = parseInt( length );
 
 	if ( length === undefined ) 
 		length = self.length;
 
 	while ( i < self.length && length ) {
  		ret[ret.length] = self[i];
 		ret.length ++;
 		ret.str += str + '/';
 		i++;
 		length --;
 	}
 
 
 	function append ( str ) {
  		self[self.length] = str;
 		self.length ++;
 		self.string += str + '/';
  	}
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
/**
	Horten
*/

function Horten ( options ) {

	var self = this;

	if ( self.constructor != Horten ) {
		return Horten.instance();
	}

	if ( !options || 'object' != typeof options ) 
		options = {};

	if ( options.debug )
		self.debug = true;
		
	self.data = {};
	self.meta = {};
	
	if ( !__global.__HortenInstance ) {
		__global.__HortenInstance = self;
	}
}

/**
 *	Return the first instantiated Horten instance. Since most projects should
 *	only require a single Horten ( in fact, multiple Hortens could get really
 *	confusing and buggy ), this should be used rather than new Horten(). 
 */

Horten.instance = function ()
{
	if ( !__global.__HortenInstance ) {
		__global.__HortenInstance = new Horten ();
	}

	return __global.__HortenInstance;
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
	var l = path.length;
	
	// Walk our data object to get the path we're after.
	for ( var i = 0; i < l && d != null; i ++ ) {
		d = d[path[i]];
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
		p = path[ i ];
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
		p = path[i];
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
	
	while ( p = path[ i ]) {
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
		if ( !path.length ) {
			return value;
		} else if ( typeof object != typeof value ) {
			d = object = {};
		} 
	}



	// Walk to one level short of where our given path tells
	// us to start. This will walk up the d variable.
	for ( i = 0; i < pathLength - 1; i ++ ) {
		p = path[i];
		
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
		p = path[i];
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

Horten.walk = function ( d, path, original ) {
	path = Path ( path );
	
	var l = path.length;
	
	if ( d == null ) {
		return undefined;
	}

	// Walk our data object to get the path we're after.
	for ( var i = 0; i < l && d != null; i ++ ) {
		d = d[path[i]];
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
		
		
		if ( options.debug )
			self.debug = true;

		if ( 'function' == typeof onData )
			self.onData = onData;

		if ( options.attach !== false ) {
			self.horten = options.horten || instance();
			self.attach ();
		}

	}
};

Listener.prototype.attach = function ( horten )
{
	var self = this;
	if ( horten ) {
		self.horten = horten;
	} 

	if ( !self.horten )
		self.horten = instance();

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
	var self = this,
		horten = self.horten || instance();

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

Listener.prototype.get = function ( path )
{
	if ( path == undefined || path == null )
		path = this.prefix;
		
	path = Path ( path ).translate ( this.prefix, this.path );

	if ( !this.horten )
		this.horten = instance();

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
		this.horten = instance();

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
inherits( Connection, Listener );

function Connection ( config ) {
	config.primitive = true;
	this.keepAlive = config.keepAlive;

	Listener.call ( this, config );
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
Connection.prototype.pull = function ( path )
{
	var self = this;
	path = Path( path ).string;

	if ( !self._pullPaths )
		self._pullPaths = [];
	
	if ( self._pullPaths.indexOf ( path ) == -1 )
		self._pullPaths.push ( path );
	
	self._pull ();
};

Connection.prototype._pull = function () 
{
	var self = this;

	if ( !self._pullPaths || !self._pullPaths.length )
		return;

	if ( !self.readyToSend () ) {
		return;
	}
	
	var msg = {
		get: self._pullPaths
	};

	if ( self.send ( msg ) ) {
		self._pullPaths = null;
	} 

}


Connection.prototype.push = function ( path )
{
	var self = this;
	path = Path ( path );

	if ( !self._pushData )
		self._pushData = {};

	self._pushData[path] = self.FILL_DATA;
	self._push();
}

Connection.prototype._push = function ()
{
	var self = this;

	if ( !self._pushData )
		return;

	if ( !self.readyToSend() ) {
		return;
	}

	var somethingToSend = false;
	
	for ( var remotePath in self._pushData ) {
		
		somethingToSend = true;
		
		if ( self._pushData[ remotePath ] == self.FILL_DATA ) {
			self._pushData[ remotePath ] = self.get ( remotePath );
		}
	}
	

	if ( somethingToSend ) {
		self.send ( { set: self._pushData } );
	}
	
	self._pushData = {};	
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
	var self = this;

	if ( self.keepAlive && 'function' == typeof self.reconnect ) {
		console.log ( self.name, 'Remote closed, retrying in 1 second' );

		setTimeout ( function () {
			self.reconnect ();
		}, 1000 );
	} else {
		console.log ( self.name, 'Closed by remote' );
		
		self.close();
	}
}

Connection.prototype.onData = function ( value, path )
{
	var self = this;

	if ( !self._pushData )
		self._pushData = {};
	
	self._pushData[path] = value;

	// Should delay push here
	self._push();
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
	var self = this;
	
	websocket.onopen = function () 
	{
		console.log ( self.name, 'Open WS' );
		self._push ();
		self._pull ();
	};
	
	websocket.onerror = function ( error ) 
	{
		console.log ( self.name, "WS error " +JSON.stringify(error) );
	};
	
	websocket.onmessage = function ( msg )
	{
		self.onRemoteData ( msg.data );		
	};
	
	websocket.onclose = function ()
	{
		//console.log ( self.name, "onclose" );
		self.onRemoteClose ();
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
		self._push ();
		self._pull ();
	}
}

Connection.prototype.attachSockJSClient = function ( sock, remotePath, config ) {
	var self = this;
	self.sockJS = sock;
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
			console.log ( self.name, "Bad JSON in server path response", msg );
			sock.close();
			self.onRemoteClose ()
			return;
		}

		if ( msg ) {
			self.attachWebSocket ( sock );
			self.onRemoteData ( msg );
		} else {
			console.log ( self.name, "Didn't get path handshake from server" );
			sock.close ();
			self.onRemoteClose ();
		}
	}

	sock.onclose = function () {
		console.log ( self.name, "Didn't get path handshake from server" );
		self.onRemoteClose ();
	}

	sock.onerror = function () {

	}
}

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
		
		if ( 'function' == typeof WebSocket || 'object' == typeof WebSocket ) {
			listener.reconnect = function () {
				console.log ( "WebSocket connecting to", url );
				client = new WebSocket ( urlStr, wsProtocol );

				listener.attachWebSocket ( client );
			}
		} else {
			//throw new Error ( 'No WebSocket library' );
			return false;
		}

	} else if ( url.protocol == 'sockjs:' ) {
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



Horten.Listener = Listener;
Horten.Client = Client;
Horten.Path = Path;

return Horten;
})( window );