var sys = require("sys");
var events = require("events");

var FreeList = require('freelist').FreeList;
var HTTPParser = process.binding('http_parser').HTTPParser;


/* Abstract base class for ServerRequest and ClientResponse. */
function IncomingMessage (socket) {
  events.EventEmitter.call(this);

  this.httpVersion = null;
  this.headers = {};

  // request (server) only
  this.url = "";

  this.method = null;

  // response (client) only
  this.statusCode = null;
}
sys.inherits(IncomingMessage, events.EventEmitter);

IncomingMessage.prototype._parseQueryString = function () {
  throw new Error("_parseQueryString is deprecated. Use require(\"querystring\") to parse query strings.\n");
};

IncomingMessage.prototype.setBodyEncoding = function (enc) {
  // TODO deprecation message?
  this.setEncoding(enc);
};

IncomingMessage.prototype.setEncoding = function (enc) {
  // TODO check values, error out on bad, and deprecation message?
  this._encoding = enc.toLowerCase();
};

IncomingMessage.prototype._addHeaderLine = function (field, value) {
  if (field in this.headers) {
    // TODO Certain headers like 'Content-Type' should not be concatinated.
    // See https://www.google.com/reader/view/?tab=my#overview-page
    this.headers[field] += ", " + value;
  } else {
    this.headers[field] = value;
  }
};

exports.parsers = new FreeList('parsers', 1000, function () {
  var parser = new HTTPParser('request');

  parser.onMessageBegin = function () {
    parser.incoming = new IncomingMessage(parser.socket);
    parser.field = null;
    parser.value = null;
  };

  // Only servers will get URL events.
  parser.onURL = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len);
    if (parser.incoming.url) {
      parser.incoming.url += slice;
    } else {
      // Almost always will branch here.
      parser.incoming.url = slice;
    }
  };

  parser.onHeaderField = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len).toLowerCase();
    if (parser.value) {
      parser.incoming._addHeaderLine(parser.field, parser.value);
      parser.field = null;
      parser.value = null;
    }
    if (parser.field) {
      parser.field += slice;
    } else {
      parser.field = slice;
    }
  };

  parser.onHeaderValue = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len);
    if (parser.value) {
      parser.value += slice;
    } else {
      parser.value = slice;
    }
  };

  parser.onHeadersComplete = function (info) {
    if (parser.field && parser.value) {
      parser.incoming._addHeaderLine(parser.field, parser.value);
    }

    parser.incoming.httpVersionMajor = info.versionMajor;
    parser.incoming.httpVersionMinor = info.versionMinor;
    parser.incoming.httpVersion = info.versionMajor
                                + '.'
                                + info.versionMinor ;

    if (info.method) {
      // server only
      parser.incoming.method = info.method;
    } else {
      // client only
      parser.incoming.statusCode = info.statusCode;
    }

    parser.onIncoming(parser.incoming, info.shouldKeepAlive);
  };

  parser.onBody = function (b, start, len) {
    // TODO body encoding?
    var enc = parser.incoming._encoding;
    if (!enc) {
      parser.incoming.emit('data', b.slice(start, start+len));
    } else {
      var string = b.toString(enc, start, start+len);
      parser.incoming.emit('data', string);
    }
  };

  parser.onMessageComplete = function () {
    parser.incoming.emit("end");
  };

  return parser;
});
