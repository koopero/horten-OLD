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
} 