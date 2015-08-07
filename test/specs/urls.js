var assert      = require('assert');
var scrape      = require('../../index');
var bs          = require('browser-sync').create('scrape');
var rmrf        = require('rimraf').sync;
var http        = require('http');
var utils       = require('../utils');
var test        = require('tape');

test('Rewriting absolute URLs to local-root urls', function (t) {

    t.plan(1);

    var target = "http://localhost:9000";
    var output = "public";
    var server = utils.staticServer('test/fixtures/absolute-urls', 9000);

    rmrf(output);

    scrape({
        input: [target],
        flags: {
            output: output
        }
    }, function (err, output) {

        if (err) {
            console.log(err);
        }

        server.cleanup();

        t.deepEqual(output.homeHtml, utils.file("test/fixtures/absolute-urls/expected.html"));
        t.end();
    });
});

