var util = require('./_util'),
    events = require('events');

EventEmitter = exports.EventEmitter = function() {
  events.EventEmitter.call(this);
};

util.inherits(EventEmitter, events.EventEmitter);

EventEmitter.prototype.emit = function(type) {
  if (type !== 'newListener' && (!this._events || !this._events[type]) &&
      this._bubbleTarget && this._bubbleTarget[type]) {
    this._bubbleTarget[type].emit.apply(this._bubbleTarget[type], arguments);
  } else {
    events.EventEmitter.prototype.emit.apply(this, arguments);
  }
};

EventEmitter.prototype.bubbleEvent = function(type, target) {
  if (!this._bubbleTarget) this._bubbleTarget = {};
  this._bubbleTarget[type] = target;
};

EventEmitter.prototype.removeBubbleEvent = function(type) {
  delete this._bubbleTarget[type];
};
