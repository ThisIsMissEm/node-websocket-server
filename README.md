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

		function braodcast(server, conn, data){
		  for(var cid in server.connections){
		    server.connections[cid].write("<"+conn._id+"> "+data);
		  }
		};

		server.addListener("connection", function(conn){
		  sys.log("<"+conn._id+"> connected");
		  braodcast(server, conn, "connected");

		  conn.addListener("close", function(){
		    sys.log("<"+conn._id+"> onClose");
		    braodcast(server, conn, "disconnected");
		  });

		  conn.addListener("message", function(message){
		    sys.log("<"+conn._id + "> "+message);
		    braodcast(server, conn, message);
		  });
		});

Coupled with a websocket client like the `example.html`, and you have a working websocket chat client (sort of.)
