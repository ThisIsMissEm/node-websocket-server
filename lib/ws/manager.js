var Events = require("events")
  , sys    = require("sys");

/*-----------------------------------------------
  Connection Manager
-----------------------------------------------*/
var Manager = function(){
  this._head = null;
  this._tail  = null;
  this._length = 0;
  
  Events.EventEmitter.call(this);
};
module.exports = Manager;
sys.inherits(Manager, Events.EventEmitter);

Object.defineProperty(Manager.prototype, "length", {
  get: function(){
    return this._length;
  }
});


Manager.prototype.attach = function(id, client){
  var connection = {
    _prev:  null,
    _next:  null,
    id:     id,
    client: client
  };
  
  if(this._length == 0) {
    this._head = connection;
    this._tail = connection;
  } else {
    this._tail._next = connection;
    connection._prev = this._tail;
    this._tail = connection;
  }
  
  ++this._length;
};

Manager.prototype.detach = function(){
  
  
};

Manager.prototype.find = function(client_id){
  var current = this._head;
  
  while(current && current.id !== client_id){
    current = current._next;
  }
  
  return current !== null ? current.client : null;
};

Manager.prototype.forEach = function(callback, thisArg){
  var context = (typeof thisArg !== "undefined" && thisArg !== null) ? thisArg : this;
  var current = this._head;
  
  while(current){
    callback.call(context, current.client);
    current = current._next;
  }
};