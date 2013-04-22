# Horten
## This is a work in progress. Try it out if you like, but you're better to wait till a release.

## Overview
Horten is an **experimental** framework for sharing and persisting schema- free, high-frequency data between multple clients and servers in real time. 

The basic principle of `Horten` is a big, globally shared object, accessible by a `Path`.

	Horten.set ( {
		screen: {
			box: {
				x: 420,
				y: 247
			}
		}
	);
	
	Horten.get ( 'screen/box/x' ) == 420
	Horten.get ( 'screen' ) == { box: { x: 420, y:247 } }
Any `Path`, whether it exists or not, can be `set` to any value. The standard order for Horten calls is ` func( value, path ) `.  
	
	Horten.set ( 252, 'screen/box/y' )
	Horten.set ( 0.6, 'colour/h' )
	Horten.set ( { colour: { s:0.1, v:1.5 } } )
`Horten.get()` is now:
	
	{
		screen: {
			box: {
				x: 420,
				y: 252
			},
			colour: {
				h: 0.6,
				s: 0.1,
				v: 1.5
			}
		}
	}
Notice that objects are merged together, never deleting values unless necessary. Values are only implicitly deleted when the topology of the object changes. 

This is useful when we start using `Listener`.

	listener = new Horten.Listener ( 'screen/box', 
		function ( value ) {
			console.log ( 'box is at', value )
		} 
	);
	
	Horten.set ( 456, 'screen/box/x' )
	
	// 'box is at' { x: 452, y: 252 }

`Listeners` are called asynchronously after the data at their `Path` changes. This means that they are called every javascript frame, rather than every time a value is changed.

	Horten.set ( 480, 'screen/box/x' )
	
	Horten.set ( 911, 'screen/box/y' )
	Horten.set ( 101, 'screen/box/y' )
	Horten.set ( 420, 'screen/box/y' )
	
	// Callback is only called once
	// 'box is at' { x: 480, y: 420 }
	
`Listeners` can also be used to `set` data at a `Path` **relative** to theirs. When a `Listener` sets itself, its `callback` is not triggered, so as to prevent echoing.

	listener.set ( { alpha: 0.8 } )
		
	// Callback is NOT called, as listener 
	
`Listeners` can also go into `primitive` mode, where they receive only primitive values, and never whole objects. This is pretty useful.

	listener = Horten.listen ( 'screen', 
		function ( value, path ) {
		
			if ( path.is( 'box/visible' ) ) {
				view.box.transparent = !value;
			}

			if ( path.startsWith ( 'colour' ) ) {
				
			}
			
		}
	)
	
# But wait, there's more!
And you'll hear all about it when I finish these docs.
	
## Connections
### MySQL
Horten can read and write a MySQL or MariaDB database. The basic row is  `( path, value, time )`, storing only **primitive** values. This allows an application to journal every part of its state in millisecond increments. This state can be recalled easily when your application is loaded. For more detail, read the [Docs](docs/MySQL.md). 
### OSC
Horten was originally designed for creative coding purposes, so naturally it includes a fully functional OSC client and server. This tested with [TouchOSC](http://hexler.net/software/touchosc) and [Quartz Composer](http://quartzcomposer.com/), although the latter hasn't been as successful. 

### http
The Horten http server is a minimal RESTful interface that allows the speedy use of `POST`, `GET`, `DELETE` on any `Path`. Security is a callback.

**Please note that Horten currently doesn't play nicely with any other frameworks, and requires its own http servers.** 
  
### Websocket / SockJS
Adding fast connections to web clients is as easy as:

	<script src='http://example.com:8000/the/path/?js'></script>

This will create a connection to the server using either `WebSocket` or `SockJS`, load the `global` `Horten` and pull down state from the server with `/the/path/` mapped as root. The local state will be set soon after any change is made on the server. Local changes will be continuously sent to the server as `(value,path)` pairs.



## Warning!
Horten is an **experimental** piece of software. It has never been used on anything but a **micro scale**, and even then it has often failed and learned. 

### Security
**Security** is not consider in way on the local level ( by design ), and on the server relegated to one placeholder callback. Horten **has not been** audited for security and may have holes which could kill or release you data.

### Stability
Horten is under continuous, if sporadic, development. It is not finished, and the API may well morph. Although there are tests, edges cases, especially concerning network and database, could probably crash it.

### Scalability
**Scalability** is somewhat theoretical at this point. There are many situations where an exponential number of changes can happen, exponentially taxing CPU, network and storage ( probably in that order ). No method is provided to throttle the number of clients, the frequency of changes or the breadth of paths. **A single misbehaving or malicious client has the capability of overloading an entire tree of clients and servers.**

### Disclaimer

**If you are planning on using Horten for a project that is large, dangerous, longterm, important or otherwise, you must conduct thorough auditing and testing. Your testing must realistic and to-scale. You will also need to write, at the very least, some framework for security and throttling.**

**I make no guarantee as to the quality of this software or its suitability to your task. That said, if you do anything big with Horten, I'd love to hear about it.**

## Greetz
* Thanks to [E Port Interactive Media](http://eportinteractive.com) for their continued support on this project.
* Thanks to [TheAlphaNerd](https://github.com/TheAlphaNerd), and those who came before, for the awesome work on [node-osc](https://github.com/TheAlphaNerd/node-osc).
* Shout to my brothers [FlyingOctopus](http://flyingoctopus.com) and [bzc](http://benzcooper.com) in [Sublight Heavy Industries](http://sublight.ca).
