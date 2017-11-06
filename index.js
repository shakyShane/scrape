const debug    = require('debug')('scrape');
const utils    = require('./lib/utils');
const meow     = require('meow');
const run      = require('./lib/command.run');

const defaultCallback = function (err, output) {
    if (err) {
        throw err;
    }
};

const cli = meow({
    help: `
    Usage
      web-scrape <url> [...options]
    
    Example: 
        web-scrape http://example.com
        
    Example: 
        web-scrape http://example.com  --target home --afterPageLoadTimeout 10000
`
});

if (!module.parent) {
    handleCli(cli, defaultCallback);
}

function handleCli (cli, cb) {

    cli.flags    = cli.flags || {};
    cli.flags.cb = cb || defaultCallback;

    if (cli.input.length === 0) {
        return;
    }

    if (cli.input.length) {
        const chromeLauncher = require('chrome-launcher');
        chromeLauncher.launch().then(chrome => {
            run(cli, {port: chrome.port}, function(err, output) {
                if (err) {
                    return console.error(err);
                }
                console.log('Closing Chrome');
                chrome.kill();
                console.log('Closing Process');
                process.exit();
            });
        });
    }
}

module.exports = handleCli;