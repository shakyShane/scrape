var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({
    //input: ["http://m2.wearejh.com/fiona-fitness-short.html"],
    //input: ["http://m2.wearejh.com/women/bottoms-women/shorts-women.html"], // cat
    //input: ["http://m2.wearejh.com/men/bottoms-men.html"], // cat
    input: ["https://www.swooneditions.com/elise-mango-wood-grey-french-bench/"], // cat
    flags: {
        afterPageLoadTimeout: 2000000000
    }
}, function (err, output) {

    var outputDir = output.config.getIn(['output', 'dir']);

    console.log('written to %s', outputDir);
});
