var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;
rmrf('public');

scrape({input: ["http://www.browsersync.io"]}, function (err, output) {
    console.log(output.after);
    //console.log(output);
    //console.log(output)
    //console.log(output)
    //if (err) {
    //    throw err;
    //}
    //bs.init({
    //    server: output.config.prefix,
    //    files: output.config.prefix
    //});
});