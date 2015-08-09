var scrape = require('./');
var bs = require('browser-sync').create();

scrape({input: ["http://www.bbc.co.uk"]}, function (err, output) {
    bs.init({
        server: output.config.prefix,
        files: output.config.prefix
    });
});