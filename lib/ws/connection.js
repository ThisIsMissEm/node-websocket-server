/*-----------------------------------------------
  Requirements:
-----------------------------------------------*/
var util = require(process.binding('natives').util ? 'util' : 'sys');
var events = require('events');
var Constants = require('constants');
var WebSocketProtocol = require('websocket-protocol');

var _events = require('../_events');
var Mixin = require('../lang/mixin');


/*-----------------------------------------------
  Constants:
-----------------------------------------------*/
var TEXT_TYPE = 'text';
var BINARY_TYPE = 'binary';


/*-----------------------------------------------
  Various utility style functions:
-----------------------------------------------*/
var debug = function() {
  // no-op, unless server.options.debug === true;
};

var close = function(connection) {
  connection.socket.end();
  connection.socket.destroy();
}


/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
module.exports = Connection;

// Our connection instance:
function Connection(server, req, upgradeHead) {
  _events.EventEmitter.call(this);

  var connection = this;
  var manager = this._manager = server.manager;
  var options = this._options = server.options;


  if (options.debug) {
    debug = function() {
      util.error(
          '\033[90mWS: ' +
          Array.prototype.join.call(arguments, ' ') +
          '\033[39m'
      );

      process.stdout.flush();
    };
  }


  this.id = manager.createId(req.socket.remotePort);

  this.req = req;
  this.socket = req.socket;

  this.protocol = WebSocketProtocol.getProtocol(this._req, upgradeHead);

  if (this.protocol === 'unknown') {
    manager.emit('invalid_connection', connection);

    if (options.close_invalid === true) {
      close(connection);
    }
  }

  // Close timeout, for browsers that don't send the close packet.
  this._closeTimer = undefined;
  this._closeFrameSent = false;


  // Setup the connection manager's state change listeners:
  connection.on('stateChange', function(state, laststate) {
    if (options.debug) {
      debug(connection.id, 'stateChange: ', laststate, '->', state);
    }

    if (state === 4) {
      manager.attach(connection);
      connection.startProtocol();
    } else if (state === 5) {
      connection.close();
    } else if (state === 6) {
      manager.detach(connection);
      connection.emit('close');
    }
  });

  // Bubble errors up to the manager.
  connection.bubbleEvent('error', manager);

  // Set the initial connecting state.
  connection.state(1);
  connection.handshake(upgradeHead);
}

util.inherits(Connection, _events.EventEmitter);


Connection.prototype.inspect = function() {
  return '<WS:Connection ' + this.id + '>';
};


/*-----------------------------------------------
  0. unknown
  1. opening
  2. waiting          deprecated
  3. handshaking
  4, connected
  5. closing
  6. closed
-----------------------------------------------*/
Connection.prototype._state = 0;


/*-----------------------------------------------
  Connection Public API
-----------------------------------------------*/
Connection.prototype.state = function(state) {
  if (state !== undefined && typeof state === 'number') {
    var oldstate = this._state;
    this._state = state;
    this.emit('stateChange', this._state, oldstate);
  }
};



Connection.prototype.startProtocol = function() {
  var incoming = this.protocol.incoming;
  var outgoing = this.protocol.outgoing;
  var socket = this.socket;

  /*-----------------------------------------------
    Socket Setup:
  -----------------------------------------------*/
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 0);

  // Handle the end of the stream, and set the state
  // appropriately to notify the correct events.
  socket.on('end', function() {
    debug(connection.id, 'end');
    close(connection);
  });

  socket.on('close', function() {
    debug(connection.id, 'socket closed');
    connection.state(6);
  });

  socket.on('timeout', function() {
    debug(connection.id, 'timed out');
    connection.emit('timeout');
  });

  socket.on('error', function(e) {
    debug(connection.id, 'error', e);
    if (e.errno != Constants.EPIPE ||
        e.errno != connection.ECONNRESET) {
      connection.emit('error', e);
    }
    connection.state(5);
  });

  // pipe data from our network socket to the incoming data parser:
  socket.pipe(incoming);

  // pipe data from the encoder to the network socket:
  outgoing.pipe(socket);


  /*-----------------------------------------------
    Incoming data parser events:
  -------------------------------------------------
      - emits:
          - text(bool:continues, string:data)
          - binary(bool:continues, buffer:data)
          - control(bool:continues, opcode, frame)
          - extension(bool:continues, opcode, frame)
          - close
          - ping
          - pong
  -----------------------------------------------*/
  incoming.on('text', function(continues, data) {
    debug(connection.id, 'received TEXT: ' + data, 'continues='+continues);
    if (!continues) {
      connection.emit('message', TEXT_TYPE, data);
    }
  });

  incoming.on('binary', function(continues, data) {
    debug(connection.id, 'received BINARY: length=' + Buffer.byteLength(data), 'continues='+continues);
    if (!continues) {
      connection.emit('message', BINARY_TYPE, data);
    }
  });

  incoming.on('ping', function() {
    debug(connection.id, 'received PING (sent PONG)');
    outgoing.pong();
  });

  incoming.on('pong', function() {
    debug(connection.id, 'received PONG');
    // TODO: handle a pong response when the
    //       server initiated the PING.
  });

  incoming.on('close', function() {
    debug(connection.id, 'requested close');

    // TODO: Add hard/soft close?
    connection.close();
  });


  /*-----------------------------------------------
    Outgoing from the encoder to the socket:
  -----------------------------------------------*/
  outgoing.on('error', function(err) {
    debug(err);
  });
};


Connection.prototype.handshake = function(upgradeHead) {
  var connection = this;

  if (this._state < 3) {
    debug(this.id, 'Connection Handshake In Progress');
    this.state(3);

    this.protocol.handshake(this.req, upgradeHead, function(err) {
      if (err) {
        debug(connection.id, 'Connection Handshake Error');
        throw err;
      } else {
        debug(connection.id, 'Connection Handshake Successful');
        connection.state(4);
      }
    });
  } else {
    debug(this.id, 'Already handshaked.');
  }
};


Connection.prototype.write = function(data) {
  if (this._state === 4) {
    if (Buffer.isBuffer(data)) {
      this.protocol.outgoing.binary(data);
    } else {
      this.protocol.outgoing.text(data);
    }
  } else {
    debug(this.id, '\033[31mSend failed due to connection not being open.');
  }
  return false;
};

// alias
Connection.prototype.send = Connection.prototype.write;


Connection.prototype.broadcast = function(data) {
  this._manager.forEach(function(client) {
    if (client && client.id != this.id) {
      client.write(data);
    }
  }, this);
};


Connection.prototype.close = function() {
  var connection = this;

  if (connection._state == 4 || connection._state == 5) {

    if (!connection._closeFrameSent) {
      connection.protocol.outgoing.close();
      connection._closeFrameSent = true;
    }

    // Add a two second timeout for closing connections.
    connection._closeTimer = setTimeout(function() {
      close(connection);
    }, 15 * 1000);
  }
};