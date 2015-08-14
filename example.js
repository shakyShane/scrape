var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({input: ["http://www.bbc.co.uk/"]}, function (err, output) {

    var outputDir = output.config.get('outputDir');

    bs.init({
        server: outputDir,
        files: outputDir
    });
});