var Chrome        = require('chrome-remote-interface');
var parse         = require('url').parse;
var debug         = require('debug')('scrape');
var write         = require('fs').writeFileSync;
var read          = require('fs').readFileSync;
var exists        = require('fs').existsSync;
var basename      = require('path').basename;
var join          = require('path').join;
var utils         = require('./lib/utils');
var items         = [];
var allItems      = {
    text: [],
    bin: [],
    home: []
};
var meow          = require('meow');

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

    cb           = cb || defaultCallback;
    var target   = parse(cli.input[0]);
    var config   = require("./lib/config")(cli.flags);
    var prefix   = cli.flags.output || "public";

    var pageload    = false;
    var indexOutput = join(process.cwd(), prefix, 'index.html');

    if (target.path !== '/') {
        indexOutput = join(process.cwd(), prefix, target.path, 'index.html');
    }

    setTimeout(function () {
        Chrome(function (chrome) {
            /**
             * Disable cache & clear cookies
             */
            chrome.Network.clearBrowserCache();
            chrome.Network.clearBrowserCookies();

            /**
             *
             */
            chrome.Network.requestServedFromCache(function (res) {
                debug('Served from cache:', res);
            });

            /**
             * Handle incoming requests
             */
            chrome.Network.requestWillBeSent(function (params) {

                /**
                 * Always decorate incoming req object with parsed URL
                 * @type {number|*}
                 */
                params.url = parse(params.request.url);
                debug("REQ", basename(params.url.path), params.url.href);

                /**
                 * If we're not done with initial page load yet, push
                 * this item into the 'later' stack
                 */
                if (!pageload) {
                    items.push(params);
                } else {
                    /**
                     * Filter req objects for downloadables
                     */
                    var filtered = utils.filterRequests([params], config);
                    /**
                     * If there are text items in the queue, download them
                     */
                    if (filtered.text.length) {
                        allItems.text = allItems.text.concat(filtered.text);
                        utils.downloadText(filtered.text, config, chrome, function (err, tasks) {
                            if (exists(indexOutput)) {
                                debug("HOME: REwritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(indexOutput, "utf8"), tasks, indexOutput);
                            }
                        });
                    }
                    /**
                     * If there are binary items in the queue, download them
                     */
                    if (filtered.bin.length) {
                        allItems.bin = allItems.bin.concat(filtered.bin);
                        utils.downloadBin(filtered.bin, config, function (err, tasks) {
                            if (exists(indexOutput)) {
                                debug("HOME: REwritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(indexOutput, "utf8"), tasks, indexOutput);
                            }
                        });
                    }
                }
            });

            chrome.Page.loadEventFired(function () {

                /**
                 * Set the page load flag.
                 * This is to indicate that we have enough resources cached
                 * to build out the site
                 * @type {boolean}
                 */
                pageload = true;

                var filtered     = utils.filterRequests(items, config);
                var rewriteTasks = [];

                allItems.home    = allItems.home.concat(filtered.home);

                utils.downloadText(filtered.text, config, chrome, function (err, tasks) {

                    debug(String(tasks.length) + " text files written");

                    rewriteTasks = rewriteTasks.concat(tasks);

                    utils.downloadBin(filtered.bin, config, function (err, tasks) {

                        if (err) {
                            console.error(err);
                        }

                        debug(String(tasks.length) + " binary files written");

                        rewriteTasks = rewriteTasks.concat(tasks);

                        utils.downloadOne(filtered.home[0], chrome, function (err, body) {
                            if (err) {
                                return cb(err);
                            }

                            var newHtml = utils.writeWithTasks(body, rewriteTasks, indexOutput);

                            debug(String(1) + " Homepage written");
                            debug('Chrome closed');

                            cb(null, {
                                homeHtml: newHtml,
                                chrome: chrome,
                                items: allItems
                            });
                        });
                    });
                });
            });

            chrome.Network.enable();
            chrome.Page.enable();
            chrome.once('ready', function () {
                chrome.Page.navigate({'url': target.href});
            });
        }).on('error', function () {
            console.error('Cannot connect to Chrome');
        });
    }, 3000);
}

module.exports = handleCli;