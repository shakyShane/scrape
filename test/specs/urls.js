var scrape = require('../../index');
var rmrf   = require('rimraf').sync;
var http   = require('http');
var utils  = require('../utils');
var test   = require('tape');

test('Rewriting absolute URLs to local-root urls', function (t) {

    var port     = 9000;
    var target   = 'http://localhost:' + port;
    var output   = 'public';
    var dir      = 'test/fixtures/absolute-urls';
    var expected = 'test/fixtures/absolute-urls/expected.html';
    var outIndex = 'public/index.html';
    var server   = utils.staticServer(dir, port);

    rmrf(output);

    scrape({
        input: [target],
        flags: {
            output: output
        }
    }, function (err, output) {

        if (err) {
            console.log('er');
            throw err;
        }

        t.equal(output.before.tasks.length, 15, 'Return tasks should equal 15 as homepage does not count');

        server.cleanup();

        t.deepEqual(output.before.home.rewritten, utils.file(expected));
        t.deepEqual(output.before.home.rewritten, utils.file(outIndex));
        t.end();
    });
});

