var debug    = require('debug')('scrape');
var utils    = require('./lib/utils');
var meow     = require('meow');
var run      = require('./lib/command.run');

var defaultCallback = function (err, output) {
    if (err) {
        throw err;
    }
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

    cli.flags    = cli.flags || {};
    cli.flags.cb = cb || defaultCallback;
    var config   = require("./lib/config")(cli.flags);

    if (cli.input.length) {
        run(cli, config);
    }
}

module.exports = handleCli;