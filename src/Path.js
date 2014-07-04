/**
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

// #ifdef NODE
module.exports = Path;
var instance = function () {
	return require('./Horten.js').instance();
}
// #endif



function Path ( path ) {
  	// If the input given is already a pathd path,
 	// return it unchanged.
 	if ( path && arguments.length == 1 && path.constructor == Path ) {
 		return path;
 	}

  	// Can be called as either Path or new Path
 	if ( this.constructor != Path ) {
 		return new Path ( arguments );
 	}

 	var self = this;

 	self.string = '/';
 	self.length = 0;
 	parse( arguments );

 	//	-----------------
 	//	Parsing Functions
 	//	-----------------

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

	//	--------------------
	//	Orthogonal Convience
	//	--------------------

	self.set = function ( value, path, flags, origin, horten ) {
		horten = horten || self.horten || instance();

		if ( path == undefined )
			return horten.set( value, self, flags, origin );

		path = self.append ( path );

		return horten.set ( value, path, flags, origin );
	}

	self.get = function ( path, horten ) {
		horten = horten || self.horten || instance();

		if ( path == undefined )
			return horten.get( self );

		path = self.append ( path );

		return horten.get ( path );	
	}

	self.getNumber = function ( path, defaultValue ) {
		var horten = self.horten || instance();

		path = self.append ( path );

		return horten.getNumber( path, defaultValue );
	}

	//	---------------------------
	//	Manipulation and comparison
	//	---------------------------

	self.append = function () {
		if ( arguments.length == 0 )
			return self;

		var postfix = Path( arguments );
		if ( postfix.length == 0 )
			return self;
		
		return Path( String( self ) + String( postfix ) );
	}

	self.slice = function ( i, length ) {
		var ret = new Path();

		i = parseInt( i ) || 0;
		if ( i < 0 )
			i += self.length;

		length = parseInt( length );
		if ( isNaN( length ) ) {
			length = self.length;
		} else if ( length < 0 ) {
			length += self.length - i;
		}

		while ( i < self.length && length > 0 ) {
			var str = self[i];
			ret[ret.length] = str;
			ret.length ++;
			ret.string += str + '/';
			i++;
			length --;
		}

		return ret;
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

	self.translate = function ( root, prefix ) {
		root = Path ( root );
		var rootStrLen = root.string.length;
		
		if ( self.string.substr( 0, rootStrLen ) != root.string )
			return undefined;
		
		prefix = Path ( prefix );
		
		if ( root.string == prefix.string )
			return self;
			
		return Path ( prefix.string + self.string.substr( rootStrLen ) );
	}


	self.is = function ( compare ) {
		if ( self === compare )
			return true;

		compare = Path ( compare );
		return String( self ) === String ( compare );
	}


	self.startsWith = function ( root ) {
		root = Path ( root );
		var rootStrLen = root.string.length;
		
		if ( self.string.substr( 0, rootStrLen ) != root.string )
			return false;

		return Path ( self.string.substr( rootStrLen ) );
	}

	self.toString = function () {
		return this.string;
	}

 	return self;
}
 


