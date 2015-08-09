var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;
rmrf('public');

scrape({input: ["http://www.sunspel.com/uk/womens/new-collection.html"]}, function (err, output) {
    bs.init({
        server: output.config.prefix,
        files: output.config.prefix
    });
});