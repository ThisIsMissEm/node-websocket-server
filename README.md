# node-websocket-server #

This is a server for the WebSocket Protocol. It currently to works
with both [draft75](http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75) and [draft76](http://www.whatwg.org/specs/web-socket-protocol/) of the protocol specification.

## Compatibility ##

This module is known to work with Node.js v0.1.98. May also work on Node.js greater than v0.1.94, dependent on protocol version being used.

It has been reported that this module experiences some issues on solaris and ubuntu systems, so far these issues are unresolved, but seem to be related to the core of Node.js

## Synopsis ##

An example of a simple server that will echo the messages received back out can be found in `examples/echo-server.js`, coupled with a websocket client like the `examples/client.html`, and you have a working websocket client/server.

## Server ##

The server acts like a normal http server in many respects, and exposes much of node's http.Server events and 
methods. However, there are a few differences, and things that haven't yet been implemented.

`ws.creareServer()` returns an instance of `ws.Server`, which acts like `http.Server`. However, not all methods 
and events that act on `http.Server` will act on `ws.Server`.  Your application can handle normal http requests by listening for the "request" event. 

`ws.createServer()` and `ws.Server()` takes an options object as its only parameter. The options object has a these
defaults:

		{ debug: false,       // Boolean:         Show debug information.
	  , version: "auto"     // String:          Value must be either: draft75, draft76, auto
	  , origin: "*"         // String, Array:   A match for a valid connection origin
	  , subprotocol: null   // String, Array:   A match for a valid connection subprotocol.
	  }

After a websocket client connects to the server, the server will emit the `'connection'` event, with the `ws/connection`
instance for the connection. This means that the connection has undertaken the necessary websocket handshaking and 
is now ready to send and receive data.

**NOTE:** Currently the origin and subprotocols are not strictly checked, this will be added in future versions.

### server.listen(port, host) ###

The same as the `http.Server` listen method.

### server.send(client_id, message) ###

Sends `message` to the client with `id` of `client_id`.

### server.broadcast(message) ###

Sends `message` to all connected clients.

### server.close() ###

The same as the `http.Server` close method.

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
Use this to handle normal http connections that won't upgrade to WebSocket.

### Event: stream ###

`function (stream) { }`

The same as the `http.Server` `stream` event.

### Event: shutdown ###

`function (errno) { }`

Emits when the server is closed. Proxied from `http.Server`

### Event: close ###

`function(connection) { }`

Emits when a websocket client's connection closes. The `connection` is an instance of `ws/connection`.

## ws/connection ##

This is an instance of a client connecting to the `ws.Server`, this is similar to the `req` on a `http.Server`.

### connecting.getVersion() ###

Returns the websocket specification version that the connection is using.

### connection.write(data) ###

Publishes a message to the client.

### connection.close() ###

Closes the client's connection.

### connection.reject(reason) ###

Rejects a client's connection. `reason` is only used when the server is in debug mode.

### connection.handshake() ###

This carries out handshaking with a client, this method is semi-private.

### Event: stateChange ###

`function (state, previous_state) { }`

Each time the connection's status changes this is emitted, the state codes are:

		0. unknown
		1. opening
		2. waiting
		3. handshaking
		4, connected
		5. closed
		
A state of `2` should never be reached, if it is, please do let me know.

### Event: message ###

`function (message) { }`

Emits when a client sends a message to the server.

### Event: close ###

`function () { }`

Emits when a connection is closes.

### Event: rejected ###

`function () { }`

Emits when a connection is rejected by the server, usually for a bad handshake or version mismatch. This event is immediately followed by the `close` event

