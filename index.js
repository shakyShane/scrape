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
var meow          = require('meow');
var cli = meow({
    help: [
        'Usage',
        '  scrape <url>'
    ]
});
var target        = parse(cli.input[0]);
var prefix        = "public";
var bs            = require('browser-sync').create('scrape');
var pageload      = false;
var homePath      = resolve(prefix, 'index.html');

rmrf(prefix);

setTimeout(function () {
    Chrome(function (chrome) {
        with (chrome) {

            var NETWORK = Network;

            NETWORK.requestWillBeSent(function (params) {

                params.url = parse(params.request.url);
                debug("REQ", basename(params.url.path));

                if (!pageload) {
                    items.push(params);
                } else {
                    var filtered = utils.filterRequests([params]);
                    if (filtered.text.length) {
                        downloadText(filtered.text, function (err, tasks) {
                            if (exists(homePath)) {
                                debug("HOME: rewritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(homePath, "utf8"), tasks, homePath);
                            }
                        });
                    }
                    if (filtered.bin.length) {
                        utils.downloadBin(filtered.bin, function (err, tasks) {
                            if (exists(homePath)) {
                                debug("HOME: rewritten with ", tasks.length, 'tasks');
                                utils.writeWithTasks(read(homePath, "utf8"), tasks, homePath);
                            }
                        });
                    }
                }
            });

            NETWORK.clearBrowserCache();
            NETWORK.clearBrowserCookies();

            NETWORK.requestServedFromCache(function (res) {
                console.log('Served from cache:', res);
            });

            Page.loadEventFired(function () {

                pageload = true;

                var filtered = utils.filterRequests(items);
                var rewriteTasks = [];

                downloadText(filtered.text, function (err, tasks) {
                    debug(String(tasks.length) + " text files written");
                    rewriteTasks = rewriteTasks.concat(tasks);
                    utils.downloadBin(filtered.bin, function (err, tasks) {
                        debug(String(tasks.length) + " binary files written");
                        rewriteTasks = rewriteTasks.concat(tasks);
                        writeHomepage(filtered.home[0], rewriteTasks, function (err, homeHtml) {
                            debug(String(1) + " Homepage written");
                            bs.init({
                                server: prefix,
                                files: prefix,
                                middleware: function (req, res, next) {
                                    var url = parse(req.url);
                                    //console.log('BS: ', extname(url.path), url.path);
                                    next();
                                }
                            });
                            //close();
                        });
                    })
                });
            });

            /**
             * Download txt documents
             * @param items
             * @param cb
             */
            function downloadText (items, cb) {

                var count        = 0;
                cb = cb || function () {};
                var len          = items.length;
                var rewriteTasks = [];

                items.forEach(function (item) {

                    var output   = resolve(prefix, item.url.pathname.slice(1));
                    var _dirname = dirname(output);
                    mkdirp(_dirname);

                    NETWORK.getResponseBody(item, function (err, resp) {

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

                NETWORK.getResponseBody(homeItem, function (err, resp) {
                    var newHtml = utils.writeWithTasks(resp.body, tasks, homePath);
                    cb(null, newHtml);
                });
            }

            NETWORK.enable();
            Page.enable();
            once('ready', function () {
                Page.navigate({'url': target.href});
            });
        }
    }).on('error', function () {
        console.error('Cannot connect to Chrome');
    });
}, 3000);
