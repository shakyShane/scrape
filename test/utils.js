var express     = require('express');
var http        = require('http');
var resolve     = require('path').resolve;
var read        = require('fs').readFileSync;
var serveStatic = require('serve-static');

var utils = exports;

utils.staticServer = function (dir, port) {

    var app = express();
    app.use(serveStatic(dir));

    var server = http.createServer(app);
    server.listen(port);

    var sockets = [];

    server.on('connection', function(socket) {
        sockets.push(socket);
    });

    function cleanup () {
        server.close(function () {
            console.log("Closed out remaining connections.");
            // mongoose.connection.close(); Might want to comment this out
            process.exit();
        });

        // Add this part to manually destroy all the connections.
        sockets.forEach(function(socket) {
            socket.destroy();
        });
    }

    return {
        server: server,
        cleanup: cleanup
    }
};

utils.file = function (path) {
    return read(resolve(path), "utf-8");
};