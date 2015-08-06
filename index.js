var Chrome        = require('chrome-remote-interface');
var parse         = require('url').parse;
var debug         = require('debug')('scrape');
var write         = require('fs').writeFileSync;
var basename      = require('path').basename;
var dirname       = require('path').dirname;
var extname       = require('path').extname;
var mkdirp        = require('mkdirp').sync;
var rmrf          = require('rimraf').sync;
var resolve       = require('path').resolve;
var join       = require('path').join;
var textWhitelist = [".js", ".css", ".svg", ".html"];
var binWhitelist  = [".png", ".jpg", ".jpeg", ".gif"];
var items         = [];
var textItems     = [];
var binItems      = [];
var target        = parse("http://www.bbc.co.uk");
var prefix        = "public";
var Download      = require('download');
var bs            = require('browser-sync').create('scrape');
var pageload      = false;
var homeHtml      = "";

function filterRequests (items) {
    if (!Array.isArray(items)) {
        items = [items];
    }
    return items.reduce(function (all, item) {
        var ext = extname(item.url.pathname);
        if (item.request.url === item.documentURL) {
            all.home.push(item);
            return all;
        }
        if (textWhitelist.indexOf(ext) > -1) {
            all.text.push(item);
        }
        if (binWhitelist.indexOf(ext) > -1) {
            all.bin.push(item);
        }
        return all;
    }, {text: [], bin: [], home: []});
}

rmrf(prefix);

setTimeout(function () {
    Chrome(function (chrome) {
        with (chrome) {

            var NETWORK = Network;

            NETWORK.requestWillBeSent(function (params) {

                params.url = parse(params.request.url);

                if (!pageload) {
                    items.push(params);
                } else {
                    debug("REQ AFTER", basename(params.url.path));
                    //var filtered = filterRequests(params);
                    //console.log(filtered);
                }
            });

            NETWORK.clearBrowserCache();
            NETWORK.clearBrowserCookies();

            NETWORK.requestServedFromCache(function (res) {
                console.log('Served from cache:', res);
            });

            function downloadText (items, cb) {

                var count        = 0;
                var len          = items.length;
                var rewriteTasks = [];

                items.forEach(function (item) {

                    var output   = resolve(prefix, item.url.path.slice(1));
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

                        debug('TXT:', extname(output), basename(output));

                        count += 1;
                        if (count === len) {
                            cb(null, rewriteTasks);
                        }
                    });
                });
            }

            Page.loadEventFired(function () {

                pageload = true;

                var filtered = filterRequests(items);
                var rewriteTasks = [];

                downloadText(filtered.text, function (err, tasks) {
                    debug(String(tasks.length) + " text files written");
                    rewriteTasks = rewriteTasks.concat(tasks);
                    downloadBin(filtered.bin, function (err, tasks) {
                        debug(String(tasks.length) + " binary files written");
                        rewriteTasks = rewriteTasks.concat(tasks);
                        writeHomepage(filtered.home[0], rewriteTasks, function (err, homeHtml) {
                            debug(String(1) + " Homepage written");
                            bs.init({
                                server: prefix,
                                files: prefix,
                                middleware: function (req, res, next) {
                                    var url = parse(req.url);
                                    console.log('BS: ', extname(url.path), url.path);
                                    next();
                                }
                            });
                            //close();
                        });
                    })
                });

                /**
                 * Download a bunch of binary files
                 * @param items
                 * @param cb
                 */
                function downloadBin (items, cb) {

                    var dl = new Download({mode: '755'});
                    items.forEach(function (item) {
                        debug("BIN:", extname(item.request.url), basename(item.request.url));
                        dl.get(item.request.url, join(process.cwd(), prefix, dirname(item.url.path)));
                    });

                    dl.run(function (err, files) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, items);
                    });

                }

                /**
                 * Download and overwrite the homepage
                 * @param homeItem
                 * @param tasks
                 */
                function writeHomepage (homeItem, tasks, cb) {

                    NETWORK.getResponseBody(homeItem, function (err, resp) {

                        var homeHtml = resp.body;
                        tasks.forEach(function (item) {
                            homeHtml = homeHtml.replace(item.url.href, item.url.path);
                        });

                        var home = resolve(prefix, 'index.html');
                        write(home, homeHtml);
                        cb(null, homeHtml);
                    });

                }
            });

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
