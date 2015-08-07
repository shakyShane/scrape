var debug    = require('debug')('scrape');
var utils    = require('./lib/utils');
var meow     = require('meow');
var run      = require('./lib/command.run');

var defaultCallback = function (err, output) {
    console.log('DONE', output);
};

var cli = meow({
    help: [
        'Usage',
        '  scrape <url>'
    ]
});

if (!module.parent) {
    handleCli(cli, defaultCallback);
}

function handleCli (cli, cb) {

    var config   = require("./lib/config")(cli.flags);
    config.cb    = cb || defaultCallback;

    if (cli.input.length) {
        run(cli, config);
    }
}

module.exports = handleCli;