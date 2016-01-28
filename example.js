var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({
    input: ["http://m2.wearejh.com/women/tops-women.html"],
    flags: {
        afterPageLoadTimeout: 5000,
        transforms: {
            "/customer/section/load": (item) => {

                item.downloadName = 'load.json';
                return item;
            }
        }
    },
}, function (err, output) {

    var outputDir = output.config.getIn(['output', 'dir']);

    console.log('written to %s', outputDir);

    //bs.init({
    //    server: outputDir,
    //    files: outputDir
    //});
});
