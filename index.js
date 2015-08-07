var Chrome        = require('chrome-remote-interface');
var parse         = require('url').parse;
var debug         = require('debug')('scrape');
var write         = require('fs').writeFileSync;
var read          = require('fs').readFileSync;
var exists        = require('fs').existsSync;
var basename      = require('path').basename;
var dirname       = require('path').dirname;
var extname       = require('path').extname;
var mkdirp        = require('mkdirp').sync;
var rmrf          = require('rimraf').sync;
var resolve       = require('path').resolve;
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

    cb = cb || defaultCallback;
    var target        = parse(cli.input[0]);
    var conf          = require("./lib/config")(cli.flags);
    var prefix        = cli.flags.output || "public";
    var pageload      = false;

    var indexOutput      = join(process.cwd(), prefix, 'index.html');

    if (target.path !== '/') {
        indexOutput      = join(process.cwd(), prefix, target.path, 'index.html');
    }

    setTimeout(function () {
        Chrome(function (chrome) {

            chrome.Network.requestWillBeSent(function (params) {

                params.url = parse(params.request.url);
                debug("REQ", basename(params.url.path), params.url.href);

                if (!pageload) {
                    items.push(params);
                } else {
                    var filtered = utils.filterRequests([params]);
                    if (filtered.text.length) {
                        allItems.text = allItems.text.concat(filtered.text);
                        downloadText(filtered.text, function (err, tasks) {
                            if (exists(indexOutput)) {
                                debug("HOME: REwritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(indexOutput, "utf8"), tasks, indexOutput);
                            }
                        });
                    }
                    if (filtered.bin.length) {
                        allItems.bin = allItems.bin.concat(filtered.bin);
                        utils.downloadBin(filtered.bin, function (err, tasks) {
                            if (exists(indexOutput)) {
                                debug("HOME: REwritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(indexOutput, "utf8"), tasks, indexOutput);
                            }
                        });
                    }
                }
            });

            chrome.Network.clearBrowserCache();
            chrome.Network.clearBrowserCookies();

            chrome.Network.requestServedFromCache(function (res) {
                console.log('Served from cache:', res);
            });

            chrome.Page.loadEventFired(function () {

                pageload = true;

                var filtered     = utils.filterRequests(items);
                var rewriteTasks = [];

                allItems.home    = allItems.home.concat(filtered.home);

                downloadText(filtered.text, function (err, tasks) {

                    debug(String(tasks.length) + " text files written");

                    rewriteTasks = rewriteTasks.concat(tasks);

                    utils.downloadBin(filtered.bin, function (err, tasks) {

                        if (err) {
                            console.error(err);
                        }

                        debug(String(tasks.length) + " binary files written");

                        rewriteTasks = rewriteTasks.concat(tasks);

                        writeHomepage(filtered.home[0], rewriteTasks, function (err, homeHtml) {
                            if (err) {
                                return cb(err);
                            }

                            debug(String(1) + " Homepage written");
                            debug('Chrome closed');

                            cb(null, {
                                homeHtml: homeHtml,
                                chrome: chrome
                            });
                        });
                    });
                });
            });

            /**
             * Download txt documents
             * @param items
             * @param cb
             */
            function downloadText (items, cb) {

                var count        = 0;
                cb               = cb || function () {};
                var len          = items.length;
                var rewriteTasks = [];

                items.forEach(function (item) {

                    var output   = resolve(prefix, item.url.pathname.slice(1));
                    var _dirname = dirname(output);
                    mkdirp(_dirname);

                    chrome.Network.getResponseBody(item, function (err, resp) {

                        // Write the file to disk
                        if (resp.base64Encoded) {
                            write(
                                output,
                                new Buffer(resp.body, 'base64').toString('ascii')
                            );
                        } else {
                            write(output, resp.body);
                        }

                        rewriteTasks.push(item);

                        debug('DL txt:', extname(output), basename(output));

                        count += 1;
                        if (count === len) {
                            cb(null, rewriteTasks);
                        }
                    });
                });
            }



            /**
             * Download and overwrite the homepage
             * @param homeItem
             * @param tasks
             */
            function writeHomepage (homeItem, tasks, cb) {

                chrome.Network.getResponseBody(homeItem, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    var newHtml = utils.writeWithTasks(resp.body, tasks, indexOutput);
                    cb(null, newHtml);
                });
            }

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