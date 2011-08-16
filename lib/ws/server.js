/*-----------------------------------------------
  Requirements:
-----------------------------------------------*/
var http = require('http');
var path = require('path');
var util = require(process.binding('natives').util ? 'util' : 'sys');

var events = require('../_events');

var Manager = require('./manager'),
    Connection = require('./connection'),
    Mixin = require('../lang/mixin');

/*-----------------------------------------------
  Reflectors:
-----------------------------------------------*/
function reflectEvent(sEmitter, sType, tEmitter, tType) {
  sEmitter.addListener(sType, function() {
    tEmitter.emit.apply(
        tEmitter,
        [tType || sType].concat(Array.prototype.slice.call(arguments))
    );
  });
}

function reflectMethod(sObject, sMeth, tObject, tMeth) {
  tObject[tMeth || sMeth] = function() {
    return sObject[sMeth].apply(sObject, arguments);
  };
}

function clientWrite(client, data) {
  if (client && client._state === 4) {
    client.write(data);
  }
}

/*-----------------------------------------------
  WebSocket Server Implementation:
-----------------------------------------------*/
function Server(options) {
  var server = this;

  events.EventEmitter.call(this);

  var opts = this.options = Mixin({
    debug: true,
    close_invalid: false,
    server: undefined
  }, options);

  var http_server = this.server = opts.server || new http.Server();
  var manager = this.manager = new Manager(opts);


  http_server.on('upgrade', function(req, socket, upgradeHead) {
    new Connection(server, req, upgradeHead);
  });

  manager.bubbleEvent('error', this);

  reflectEvent(manager, 'attach', this, 'connection');
  reflectEvent(manager, 'invalid_connection', this, 'invalid_connection');
  reflectEvent(manager, 'disconnect', this, 'disconnect');

  reflectEvent(http_server, 'listening', this);
  reflectEvent(http_server, 'request', this);
  reflectEvent(http_server, 'stream', this);
  reflectEvent(http_server, 'close', this);
  reflectEvent(http_server, 'clientError', this);
  reflectEvent(http_server, 'error', this);

  reflectMethod(http_server, 'listen', this);
  reflectMethod(http_server, 'close', this);

  this.send = function(id, data) {
    manager.find(id, function(client) {
      clientWrite(client, data);
    });
  };

  this.broadcast = function(data) {
    manager.forEach(function(client) {
      clientWrite(client, data);
    });
  };

}

util.inherits(Server, events.EventEmitter);

/*-----------------------------------------------
  WebSocket Server Exports:
-----------------------------------------------*/
exports.Server = Server;
exports.createServer = function(options) {
  return new Server(options);
};

exports.Connection = Connection;
exports.Manager = Manager;
