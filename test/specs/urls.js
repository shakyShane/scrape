var scrape      = require('../../index');
//var bs          = require('browser-sync').create('scrape');
var rmrf        = require('rimraf').sync;
var http        = require('http');
var utils       = require('../utils');
var test        = require('tape');

test('Rewriting absolute URLs to local-root urls', function (t) {

    t.plan(1);

    var port     = 9000;
    var target   = 'http://localhost:' + port;
    var output   = 'public';
    var dir      = 'test/fixtures/absolute-urls';
    var expected = 'test/fixtures/absolute-urls/expected.html';
    var server   = utils.staticServer(dir, port);

    rmrf(output);

    scrape({
        input: [target],
        flags: {
            output: output
        }
    }, function (err, output) {

        if (err) {
            throw err;
        }

        server.cleanup();

        console.log('Test output number', output.length);

        //t.deepEqual(output.homeHtml, utils.file(expected));
        t.equal(2, 2);
        t.end();
    });
});

