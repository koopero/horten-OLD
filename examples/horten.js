var H = require('horten');


/*
	Merge some objects together.
*/
console.log ( 
	H.merge( { 'foo': 'bar' }, { bar: 'baz '} ) 
);

console.log ( 
	H.merge( { 'foo': 'bar' }, 4 ) 
);

console.log ( 
	H.merge( 'This will be destroyed.', { 'ratio':'regum' }, 'ultima' )
);