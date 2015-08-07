var assert      = require('assert');
var scrape      = require('../index');
var experss     = require('express');
var http        = require('http');
var serveStatic = require('serve-static');
var bs            = require('browser-sync').create('scrape');
var rmrf        = require('rimraf').sync;

var app = experss();
    app.use(serveStatic('test/fixtures/absolute-urls'));

var server = app.listen(9000);
var target = "http://localhost:9000";
var output = "public";

rmrf(output);

scrape({
    input: ["http://localhost:9000"],
    flags: {
        output: output
    }
}, function (err, output) {

    if (err) {
        console.log(err);
    }

    console.log(output.home);

    output.chrome.close();

    //bs.init({
    //    server: prefix,
    //    files: prefix,
    //    startPath: target.path,
    //    middleware: function (req, res, next) {
    //        var url = parse(req.url);
    //        console.log('BS: ', extname(url.path), url.path);
            //next();
        //}
    //});
    server.close();
});
