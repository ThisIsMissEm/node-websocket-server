var debug = function(){}
  , util = require('util')
  , events = require('../_events');

(Manager = function(options) {
  if(options.debug) {
    var self = this;
    debug = function(msg, connection) {
      if(connection && connection.id) {
        util.debug('\033[31mManager: ' +msg+ ": <Connection "+connection.id+"> ("+self._length+")\033[39m");
      } else {
        util.debug('\033[31mManager: ' +Array.prototype.join.call(arguments, " ")+" ("+self._length+")\033[39m");
      }
    };
    setInterval(function() { util.debug('\033[31m'+util.inspect(self)+'\033[39m') }, 1000);
  }
})
.prototype = {
  __proto__: events.EventEmitter.prototype,
  _head: null, _tail: null, _length: 0, _counter: 0, 
  createId: function(remotePort) { return process.pid + "" + remotePort + "" + (this._counter++); },
  inspect: function() { return "<WS:Manager "+this._length+" (total: "+this._counter+")>"; },
  attach: function(connection) {
    var client = { id: connection.id, _next:  null, connection: connection };
    if(this._length == 0) {
      this._head = client;
      this._tail = client;
    } else {
      this._tail._next = client;
      this._tail = client;
    }
    ++this._length;
    this.emit("attach", connection);
    debug("Attached", connection);
  },
  detach: function(connection) {
    var previous = current = this._head, id = connection.id;
    while(current !== null) {
      if(current.id === id) {
        previous._next = current._next;
        current.id === this._head.id && (this._head = current._next);
        current.id === this._tail.id && (this._tail = previous);      
        this._length--;
        this.emit("detach", connection);
        debug("Detached", connection);
        break;
      }
      previous = current;
      current = current._next;
    }
    current === null && debug("Detach Failed", connection); 
    delete current, previous;
  },
  find: function(id, callback, thisArg) {
    var current = this._head;
    while(current !== null) {
      if(current.id === id) {
        callback.call(thisArg, current.connection);
        break;
      }
      current = current._next;
    }
  },
  forEach: function(callback, thisArg){
    var current = this._head;
    while(current !== null) {
      callback.call(thisArg, current.connection);
      current = current._next;
    }
  },
  map: function(callback, thisArg){
    var current = this._head, result = [], len = 0;
    while(current !== null) {
      result.push(callback.call(thisArg, current.connection, len, this._head));
      current = current._next;
      len++;
    }
    return result;
  },
  filter: function(callback, thisArg){
    var current = this._head, result = [], len = 0;
    while(current !== null) {
      if( Boolean(callback.call(thisArg, current.connection, len, this._head)) ) {
        result.push(current.connection);
      }
      current = current._next;
      len++;
    }
    return result;
  }
};

Object.defineProperty(Manager.prototype, "length", {
  get: function() { return this._length; }
});

module.exports = Manager;