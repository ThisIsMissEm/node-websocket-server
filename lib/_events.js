var events = require("events");
(EventEmitter = function(){})
.prototype = {
  __proto__: events.EventEmitter.prototype,
  emit: function(type) {
    if(type !== "newListener"
      && (!this._events || !this._events[type])
      && this._bubbleTarget && this._bubbleTarget[type]
    ) {
      this._bubbleTarget[type].emit.apply(this._bubbleTarget[type], arguments);
    } else {
      events.EventEmitter.prototype.emit.apply(this, arguments);
    }
  },
  bubbleEvent: function(type, target) {
    if(!this._bubbleTarget) this._bubbleTarget = {};
    this._bubbleTarget[type] = target;
  },
  removeBubbleEvent: function(type) {
    delete this._bubbleTarget[type];
  }
};

exports.EventEmitter = EventEmitter;

exports.reflectEvents = function(se, sts, te, tt) {
  sts.forEach( function(st) {
    se.on(st, function() { te.emit.apply(te, [tt||st].concat(arguments)) })
  });
};
exports.reflectMethods = function(so, sms, to, tm) {
  sms.forEach( function(sm) {
    to[tm||sm] = function() { return so[sm].apply(so, arguments); };
  });
};