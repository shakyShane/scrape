var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({
    //input: ["http://m2.wearejh.com/fiona-fitness-short.html"],
    //input: ["http://m2.wearejh.com/women/bottoms-women/shorts-women.html"], //cat
    //input: ["http://m2.wearejh.com/men/bottoms-men.html"], //cat
    input: ["http://m2.wearejh.com/ajax-full-zip-sweatshirt.html"], //cat
    flags: {
        afterPageLoadTimeout: 50000
    }
}, function (err, output) {

    var outputDir = output.config.getIn(['output', 'dir']);

    console.log('written to %s', outputDir);

    //bs.init({
    //    server: outputDir,
    //    files: outputDir
    //});
});
