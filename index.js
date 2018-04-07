#!/usr/bin/env node
const debug    = require('debug')('scrape');
const utils    = require('./lib/utils');
const meow     = require('meow');
const run      = require('./lib/command.run');
const watch    = require('./lib/command.watch');

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
        
    Example (with additional domains): 
        web-scrape http://example.com  --domains sub.example.com
`
});

const commands = new Set(['watch']);
const commandMap = {watch, run};

if (!module.parent) {
    handleCli(cli, defaultCallback);
}

function handleCli (cli, cb) {

    cli.flags    = cli.flags || {};
    cli.flags.cb = cb || defaultCallback;

    if (cli.input.length === 0) {
        return;
    }

    if (cli.flags.noLaunch) {
        const port = cli.flags.port || 9222;
        return run(cli, {port}, function(err, output) {
            if (err) {
                if (err.code === 'ECONNREFUSED') {
                    return console.log(`ERROR: Chrome not running on port ${port}`);
                }
                console.error(err);
            }
            console.log('Closing Chrome');
            console.log('Closing Process');
            process.exit();
        });
    }

    if (cli.input.length) {
        const chromeLauncher = require('chrome-launcher');

        if (commands.has(cli.input[0])) {
            const [command, url] = cli.input;
            chromeLauncher.launch({startingUrl: url, headless: false}).then(chrome => {
                return commandMap[command](cli, {port: chrome.port}, function(err, output) {
                    if (err) {
                        return console.error(err);
                    }
                    console.log('Closing Chrome');
                    chrome.kill();
                    console.log('Closing Process');
                    process.exit();
                });
            });
            return;
        }
        chromeLauncher.launch({startingUrl: cli.input[0]}).then(chrome => {
            return run(cli, {port: chrome.port}, function(err, output) {
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
