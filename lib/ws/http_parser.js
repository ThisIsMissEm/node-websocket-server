var FreeList = require('freelist').FreeList,
    HTTPParser = process.binding('http_parser').HTTPParser;

/* Abstract base class for ServerRequest and ClientResponse. */
function IncomingMessage () {
  return {
    httpVersion: null,
    headers: {},
    url: "",
    method: null,
    
    _addHeaderLine: function (field, value) {
      if (field in this.headers) {
        // TODO Certain headers like 'Content-Type' should not be concatinated.
        // See https://www.google.com/reader/view/?tab=my#overview-page
        this.headers[field] += ", " + value;
      } else {
        this.headers[field] = value;
      }
    }
  };
};

module.exports = new FreeList('parsers', 1000, function () {
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

    parser.incoming.upgrade = info.upgrade;

    if (!info.upgrade) {
      // For upgraded connections, we'll emit this after parser.execute
      // so that we can capture the first part of the new protocol
      parser.onIncoming(parser.incoming, info.shouldKeepAlive);
    }
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
    if (!parser.incoming.upgrade) {
      // For upgraded connections, also emit this after parser.execute
      parser.incoming.emit("end");
    }
  };

  return parser;
});

