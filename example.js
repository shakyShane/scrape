var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({
    input: ["http://m2.wearejh.com/karmen-yoga-pant.html"],
    flags: {
        afterPageLoadTimeout: 10000
    }
}, function (err, output) {

    var outputDir = output.config.get('outputDir');

    //bs.init({
    //    server: outputDir,
    //    files: outputDir
    //});
});
