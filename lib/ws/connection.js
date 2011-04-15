/*-----------------------------------------------
  Requirements:
-----------------------------------------------*/
var debug = function() {};

var util = require('../_util'),
    events = require('events'),
    Url = require('url'),
    Buffer = require('buffer').Buffer,
    Crypto = require('crypto'),
    Constants = require('constants');

var _events = require('../_events');
var Mixin = require('../lang/mixin');

var CLOSE_FRAME = new Buffer(2);

CLOSE_FRAME[0] = 0xFF;
CLOSE_FRAME[1] = 0x00;

/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
module.exports = Connection;

// Our connection instance:
function Connection(manager, options, req, socket, upgradeHead) {
  var _firstFrame, connection = this;

  _events.EventEmitter.call(this);

  this._req = req;
  this._socket = socket;
  this._manager = manager;
  this.id = manager.createId(socket.remotePort);

  this._options = Mixin({
    version: 'auto',    // String: Value must be either: draft75, draft76, auto
    origin: '*',        // String,Array: Valid connection origins.
    subprotocol: '*',   // String,Array: Valid connection subprotocols.
    debug: true
  }, options);

  if (connection._options.debug) {
    debug = function() {
      util.error(
          '\033[90mWS: ' +
          Array.prototype.join.call(arguments, ' ') +
          '\033[39m'
      );
      process.stdout.flush();
    };
  }

  Object.defineProperties(this, {
    version: {
      get: function() {
        if (req.headers['sec-websocket-key1'] &&
            req.headers['sec-websocket-key2']) {
          return 'draft76';
        }
        return 'draft75';
      }
    }
  });

  // Close timeout, for browsers that don't send the close packet.
  connection._closeTimer = undefined;

  // Set the initial connecting state.
  connection.state(1);
  // Setup the connection manager's state change listeners:
  connection.on('stateChange', function(state, laststate) {
    if (connection._options.debug) {
      debug(connection.id, 'stateChange: ', laststate, '->', state);
    }

    if (state === 4) {
      manager.attach(connection);
      // Handle first frame breakages.
      if (_firstFrame) {
        parser.write(_firstFrame);
        delete _firstFrame;
      }
    } else if (state === 5 && laststate !== 6 && laststate !== 5) {
      close(connection);
    } else if (state === 6 && laststate === 5) {
      manager.detach(connection);
      connection.emit('close');
    }
  });


  // Start to process the connection
  if (!checkVersion(this)) {
    this.reject('Invalid version.');
  } else {
    // Let the debug mode know that we have a connection:
    debug(this.id, this.version + ' connection');

    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);

    // Handle incoming data:
    var parser = new Parser(this);

    parser.on('message', function(message) {
      debug(connection.id, 'recv: ' + message);
      connection.emit('message', message);
    });

    parser.on('close', function() {
      debug(connection.id, 'requested close');

      // Timer to catch clients that don't send close packets.
      // I'm looking at you safari and chrome.
      if (connection._closeTimer) {
        clearTimeout(connection._closeTimer);
      }
      connection.state(5);
    });

    socket.on('data', function(data) {
      parser.write(data);
    });

    // Handle the end of the stream, and set the state
    // appropriately to notify the correct events.
    socket.on('end', function() {
      debug(connection.id, 'end');
      connection.state(5);
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

    // Bubble errors up to the manager.
    connection.bubbleEvent('error', manager);

    // Carry out the handshaking.
    //    - Draft75: There's no upgradeHead, goto Then.
    //      Draft76: If there's an upgradeHead of the right length, goto Then.
    //      Then: carry out the handshake.
    //
    //    - Currently no browsers to my knowledge split the upgradeHead off
    //      the request,
    //      but in the case it does happen, then the state is set to waiting for
    //      the upgradeHead.
    //
    // This switch is sorted in order of probably of occurence.
    switch (this.version) {
      case 'draft76':
        if (upgradeHead.length >= 8) {
          if (upgradeHead.length > 8) {
            _firstFrame = upgradeHead.slice(8, upgradeHead.length);
          }

          handshakes.draft76(connection, upgradeHead.slice(0, 8));
        } else {
          connection.reject('Missing key3');
        }
        break;
      case 'draft75':
        handshakes.draft75(connection);
        break;
      default:
        connection.reject('Unknown version: ' + this.version);
        break;
    }
  }
}

util.inherits(Connection, _events.EventEmitter);

/*-----------------------------------------------
  Various utility style functions:
-----------------------------------------------*/
function write(connection, data) {
  debug(connection.id, 'write: ', data.inspect());
  if (connection._socket.writable) {
    return connection._socket.write(data);
  }
  return false;
}

function close(connection) {
  connection._socket.end();
  connection._socket.destroy();
  debug(connection.id, 'socket closed');
  connection.state(6);
}

function checkVersion(connection) {
  var server_version = connection._options.version.toLowerCase();

  return (server_version == 'auto' || server_version == connection.version);
}


function pack(num) {
  var result = '';
  result += String.fromCharCode(num >> 24 & 0xFF);
  result += String.fromCharCode(num >> 16 & 0xFF);
  result += String.fromCharCode(num >> 8 & 0xFF);
  result += String.fromCharCode(num & 0xFF);
  return result;
}


/*-----------------------------------------------
  Formatters for the urls
-----------------------------------------------*/

// TODO: Properly handle origin headers.
function websocket_origin(connection) {
  var origin = connection._options.origin || '*';

  if (origin == '*' || Array.isArray(origin)) {
    origin = connection._req.headers.origin;
  }

  return origin;
}

function websocket_location(connection) {
  if (connection._req.headers['host'] === undefined) {
    connection.reject('Missing host header');
    return;
  }

  var location = '',
      secure = connection._socket.secure,
      host = connection._req.headers.host.split(':'),
      port = host[1] !== undefined ? host[1] : (secure ? 443 : 80);

  location += secure ? 'wss://' : 'ws://';
  location += host[0];

  if (!secure && port != 80 || secure && port != 443) {
    location += ':' + port;
  }

  location += connection._req.url;

  return location;
}


/*-----------------------------------------------
  0. unknown
  1. opening
  2. waiting
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

Connection.prototype.inspect = function() {
  return '<WS:Connection ' + this.id + '>';
};

Connection.prototype.write = function(data) {
  if (this._state === 4) {
    var byteLen = Buffer.byteLength(data, 'utf8'),
        bytes = new Buffer(byteLen + 2);

    bytes[0] = 0x00;
    bytes.write(data, 1, 'utf8');
    bytes[byteLen + 1] = 0xFF;

    return write(this, bytes);
  } else {
    debug(this.id, '\033[31mCould not send.');
  }
  return false;
};

Connection.prototype.send = Connection.prototype.write;

Connection.prototype.broadcast = function(data) {
  this._manager.forEach(function(client) {
    if (client && client._state === 4 && client.id != this.id) {
      client.write(data);
    }
  }, this);
};

Connection.prototype.close = function() {
  var connection = this;

  if (connection._state == 4 && connection._socket.writable) {
    write(connection, CLOSE_FRAME);
  }

  // Add a two second timeout for closing connections.
  connection._closeTimer = setTimeout(function() {
    connection.state(5);
  }, 15 * 1000);
};

Connection.prototype.reject = function(reason) {
  debug(this.id, 'rejected. Reason: ' + reason);
  this.state(5);
};

Connection.prototype.handshake = function() {
  if (this._state < 3) {
    debug(this.id, this.version + ' handshake');

    this.state(3);

    doHandshake[this.version].call(this);
  } else {
    debug(this.id, 'Already handshaked.');
  }
};

/*-----------------------------------------------
  Do the handshake.
-----------------------------------------------*/
var handshakes = {
  // Using draft75, work out and send the handshake.
  draft75: function(connection) {
    connection.state(3);

    var location = websocket_location(connection), res;

    if (location) {
      res = 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
          'Upgrade: WebSocket\r\n' +
          'Connection: Upgrade\r\n' +
          'WebSocket-Origin: ' + websocket_origin(connection) + '\r\n' +
          'WebSocket-Location: ' + location;

      if (connection._options.subprotocol &&
          typeof connection._options.subprotocol == 'string') {
        res += '\r\nWebSocket-Protocol: ' + connection._options.subprotocol;
      }

      connection._socket.write(res + '\r\n\r\n', 'ascii');

      connection.state(4);
    }
  },

  // Using draft76 (security model), work out and send the handshake.
  draft76: function(connection, upgradeHead) {
    connection.state(3);

    var location = websocket_location(connection), res;

    if (location) {
      res = 'HTTP/1.1 101 WebSocket Protocol Handshake\r\n' +
          'Upgrade: WebSocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Origin: ' + websocket_origin(connection) + '\r\n' +
          'Sec-WebSocket-Location: ' + location;

      if (connection._options.subprotocol &&
          typeof connection._options.subprotocol == 'string') {
        res += '\r\nSec-WebSocket-Protocol: ' + connection._options.subprotocol;
      }

      var strkey1 = connection._req.headers['sec-websocket-key1'],
          strkey2 = connection._req.headers['sec-websocket-key2'],
          numkey1 = parseInt(strkey1.replace(/[^\d]/g, ''), 10),
          numkey2 = parseInt(strkey2.replace(/[^\d]/g, ''), 10),
          spaces1 = strkey1.replace(/[^\ ]/g, '').length,
          spaces2 = strkey2.replace(/[^\ ]/g, '').length;


      if (spaces1 == 0 || spaces2 == 0 ||
          numkey1 % spaces1 != 0 || numkey2 % spaces2 != 0) {
        connection.reject('WebSocket Handshake contained an invalid key');
      } else {
        var hash = Crypto.createHash('md5'),
            key1 = pack(parseInt(numkey1 / spaces1)),
            key2 = pack(parseInt(numkey2 / spaces2));

        hash.update(key1);
        hash.update(key2);
        hash.update(upgradeHead.toString('binary'));

        res += '\r\n\r\n';
        res += hash.digest('binary');

        connection._socket.write(res, 'binary');

        connection.state(4);
      }
    }
  }
};

/*-----------------------------------------------
  The new onData callback for
  http.Server IncomingMessage
-----------------------------------------------*/
function Parser() {
  events.EventEmitter.call(this);

  this.frameData = [];
  this.order = 0;
  this.closing = false;
}

util.inherits(Parser, events.EventEmitter);

Parser.prototype.write = function(data) {
  var pkt, msg;

  debug('parse.write', data.inspect());

  for (var i = 0, len = data.length; i < len; i++) {
    if (this.order == 0) {
      if (data[i] & 0x80 == 0x80) {
        this.order = 1;
      } else {
        this.order = -1;
      }
    }

    if (this.order == -1) {
      if (data[i] === 0xFF) {
        pkt = new Buffer(this.frameData);
        this.order = 0;
        this.frameData = [];

        this.emit('message', pkt.toString('utf8', 0, pkt.length));
      } else if (data[i] !== 0x00) {
        this.frameData.push(data[i]);
      }
    } else if (this.order == 1) {
      if (this.closing && data[i] === 0x00) {
        this.emit('close');
        this.closing = false;
      } else if (data[i] === 0xFF && this.frameData.length == 0) {
        this.closing = true;
      } else {
        debug('High Order packet handling is not yet implemented.');
        this.order = 0;
        this.closing = false;
      }
    }
  }
};

/*
function ondata(data, start, end) {
  if (this.state == 2 && this.version == 'draft76') {
    // TODO: I need to figure out an alternative here.
    // data.copy(this._req.upgradeHead, 0, start, end);
    debug.call(this, 'Using draft76 & upgrade body not sent with request.');
    this.reject('missing upgrade body');
  // Assume the data is now a message:
  } else if (this.state == 4) {
    data = data.slice(start, end);

    var frame_type = null, length, b;
    var parser_offset = -1;
    var raw_data = [];

    while(parser_offset < data.length-2) {
      frame_type = data[parser_offset ++ ];

      if (frame_type & 0x80 == 0x80) {
        debug.call(this, 'high');
        b = null;
        length = 1;
        while(length--) {
          b = data[parser_offset ++ ];
          length = length * 128 + (b & 0x7F);
          if (b & 0x80 == 0) {
            break;
          }
        }
        parser_offset += length;
        if (frame_type == 0xFF && length == 0) {
          this.close();
        }
      } else {
        raw_data = [];

        while(parser_offset <= data.length) {
          b = data[parser_offset ++ ];
          if (b == 0xFF) {
            var buf = new Buffer(raw_data);
            this.emit('message', buf.toString('utf8', 0, buf.length));
            break;
          }
          raw_data.push(b);
        }
      }
    }
  }
};
*/
