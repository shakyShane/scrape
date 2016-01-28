var scrape = require('../../index');
var rmrf   = require('rimraf').sync;
var exists = require('fs').existsSync;
var join   = require('path').join;
var http   = require('http');
var utils  = require('../utils');
var test   = require('tape');

test.only('Rewriting absolute URLs to flat directory structure', function (t) {

    var port     = 9000;
    var target   = 'http://localhost:' + port;
    var output   = 'public';
    var dir      = 'test/fixtures/absolute-urls';
    var expected = 'test/fixtures/absolute-urls/expected-flat.html';
    var outIndex = 'public/index.html';
    var server   = utils.staticServer(dir, port);

    rmrf(output);

    scrape({
        input: [target],
        flags: {
            outputDir: output,
            flat: true
        }
    }, function (err, output) {

        if (err) {
            console.log('er');
            throw err;
        }

        server.cleanup();

        t.equal(exists(join(process.cwd(), 'public/js/app.min.js')), true);


        //t.equal(exists())


        //t.deepEqual(before.home.rewritten, utils.file(expected));
        //t.deepEqual(before.home.rewritten, utils.file(outIndex));
        t.end();
    });
});

