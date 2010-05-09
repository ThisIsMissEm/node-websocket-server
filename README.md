# node-websocket-server #

**IMPORTANT: ** This module only works with node v0.1.94 and later.

This is a server for the WebSocket Protocol. It is designed to work 
with both [draft75](http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75) and [draft76 or later](http://www.whatwg.org/specs/web-socket-protocol/) of the protocol specification.

## Synopsis ##

An example of a simple server that will echo the messages received back out.

		var sys = require("sys");
		var ws = require('./lib/ws');
		
		var server = ws.createServer();
		server.listen(8000);

		server.addListener("listening", function(){
		  sys.log("Listening for connections.");
		});

		function broadcast(server, conn, data){
		  for(var cid in server.connections){
		    server.connections[cid].write("<"+conn._id+"> "+data);
		  }
		};

		server.addListener("connection", function(conn){
		  sys.log("<"+conn._id+"> connected");
		  broadcast(server, conn, "connected");

		  conn.addListener("close", function(){
		    sys.log("<"+conn._id+"> onClose");
		    broadcast(server, conn, "disconnected");
		  });

		  conn.addListener("message", function(message){
		    sys.log("<"+conn._id + "> "+message);
		    broadcast(server, conn, message);
		  });
		});

Coupled with a websocket client like the `example.html`, and you have a working websocket chat client (sort of.)

## Server ##

The server acts like a normal http server in many respects, and exposes much of node's http.Server events and 
methods. However, there are a few differences, and things that haven't yet been implemented.

`ws.creareServer()` returns an instance of `ws.Server`, which acts like `http.Server`. However, not all methods 
and events that act on `http.Server` will act on `ws.Server`.

`ws.createServer()` and `ws.Server()` takes an options object as its only parameter. The options object has a these
defaults:

		{ version: "draft75"  // [string] Maybe be either draft75 or draft76
		, origin: "*"         // [string | array] Any valid domain name
		, subprotocol: null   // [string | array]
	  }

After a websocket client connects to the server, the server will emit the `'connection'` event, with the `ws/connection`
instance for the connection. This signifies that the connection has undertaken the necessary websocket handshaking and 
is now ready to send and receive data.

### server.listen(port, host) ###

The same as the `http.Server` listen method.

### server.end() ###

The same as the `http.Server` end method.

### Event: listening ###

`function () { }`

Emits when the server is ready to start accepting clients, after `listen` has been called.

### Event: connection ###

`function (connection) { }`

Emits when a websocket client connects to the server. The `connection` is an instance of `ws/connection`.

### Event: request ###

`function (request, response) { }`

Emits when a client connects using standard HTTP to the server.
This is the same as the `http.Server` `request` event.

### Event: stream ###

`function (stream) { }`

The same as the `http.Server` `stream` event.

### Event: close ###

`function (errno) { }`

Emits when the server is closed. Currently inherited from `http.Server`

## ws/connection ##

This is an instance of a client connecting to the `ws.Server`, this is similar to the `req` on a `http.Server`.

### connection.write(data) ###

Publishes a message to the client.

### connection.close() ###

Closes the client's connection.

### Event: readyStateChange ###

`function (readyState) { }`

Emits each time the connections status changes, the codes are as follows:

		0. unknown
		1. opening
		2. waiting
		3. handshaking
		4, connected
		5. closed

### Event: close ###

`function () { }`

Emits when a client connection is closed or closes.

### Event: message ###

`function (message) { }`

Emits when a client sends a message to the server.
