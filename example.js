var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;
rmrf('public');

scrape({input: ["http://swannodette.github.io/2015/07/29/clojurescript-17/"]}, function (err, output) {
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