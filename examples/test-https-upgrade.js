assert = require('assert');
var path = require("path");

net = require("net");
http = require("http");
url = require("url");
qs = require("querystring");
var fs = require('fs');
var sys = require('sys');

var have_openssl;
try {
  var crypto = require('crypto');
  var dummy_server = http.createServer(function(){});
  dummy_server.setSecure();
  have_openssl=true;
} catch (e) {
  have_openssl=false;
  console.log("Not compiled with OPENSSL support.");
  process.exit();
}

var request_number = 0;
var requests_sent = 0;
var server_response = "";
var client_got_eof = false;
var caPem = fs.readFileSync( path.normalize(path.join(__dirname, "test_ca.pem")), 'ascii');
var certPem = fs.readFileSync(path.normalize(path.join(__dirname, "test_cert.pem")), 'ascii');
var keyPem = fs.readFileSync(path.normalize(path.join(__dirname, "test_key.pem")), 'ascii');

var credentials = crypto.createCredentials({key:keyPem, cert:certPem, ca:caPem});

var https_server = http.createServer(function (req, res) {
  request_number++;
  res.writeHead(204, {"Content-Type": "text/plain"});
  
  res.end();
});

https_server.on("upgrade", function(req, socket, upgradeHead){
  console.log("upgrade!");
  
  request_number++;
  
  socket.write("hello");

  socket.on("data", function(d){
    console.log("server recv", d)
    socket.write("die");
  })
  
  socket.on("end", function(){
    socket.end();
    socket.destroy();
  });
})

https_server.setSecure(credentials);
https_server.listen(123456);

https_server.addListener("listening", function() {
  var c = net.createConnection(123456);

  c.setEncoding("utf8");

  c.addListener("connect", function () {
        console.log("c.connect")
    c.setSecure(credentials);
  });

  c.addListener("secure", function () {
    c.write("GET / HTTP/1.1\r\n\r\n");
    requests_sent++;
    c.write("GET / HTTP/1.1\r\nUpgrade: WebSocket\r\nConnection: Upgrade\r\n\r\n");
    requests_sent++;
  });

  c.addListener("data", function (chunk) {
    console.log("<< c: '", chunk, "'");
    if(chunk != "hello"){
      c.end();
    } else {
      c.write(chunk);
      console.log(">> c:", chunk)
    }
  });

  c.addListener("end", function () {
    console.log("c.end")
    c.destroy();
  });

  c.addListener("close", function () {
    console.log("c.close");
    console.dir(https_server);
    https_server.close();
  });
});

process.addListener("exit", function () {
  assert.equal(2, request_number);
  assert.equal(2, requests_sent);
});
