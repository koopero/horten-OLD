/**
	Path

	Defines a canonical Horten path. Horten paths are, in their string form,
	represented as slash delimited lists of segments with leading and trailing
	slashes. 
	
		/this/is/a/horten/path/
		
	Any character other than slash can be used in a path segment, although in
	the future, Horten may be extended to perform special behaviour on segments
	prefixed with underscore (_), so please avoid it. Also, it would be wise to
	avoid anything you wouldn't put in a variable name.
	
		/_don't/do/this/ /while/it might work, it's sketchy/
	
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
 
Path.prototype.seg = function ( i ) {
	return this.array[i];
}


//	--------------------
//	Orthogonal Convience
//	--------------------

Path.prototype.set = function ( value, path, flags, origin, horten ) {
	horten = horten || Horten.getInstance();

	if ( path == undefined )
		return horten.set( value, this, flags, origin );

	path = this.append ( path );

	return horten.set ( value, path, flags, origin );
}

Path.prototype.get = function ( path, horten ) {
	horten = horten || Horten.getInstance();

	if ( path == undefined )
		return horten.get( this );

	path = this.append ( path );

	return horten.get ( path );	
}


Path.prototype.append = function ( postfix ) {

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