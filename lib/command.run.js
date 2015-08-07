function concat (x, y) { return x.concat(y) }
var Chrome   = require('chrome-remote-interface');
var parse    = require('url').parse;
var debug    = require('debug')('scrape');
var write    = require('fs').writeFileSync;
var read     = require('fs').readFileSync;
var exists   = require('fs').existsSync;
var basename = require('path').basename;
var join     = require('path').join;
var utils    = require('./utils');
var Rx       = require('rx');
var items    = [];

var dlText   = Rx.Observable.fromNodeCallback(utils.downloadText);
var dlBin    = Rx.Observable.fromNodeCallback(utils.downloadBin);
var dlOne    = Rx.Observable.fromNodeCallback(utils.downloadOne);

module.exports = function (cli, config) {

    var target   = parse(cli.input[0]);
    var pageload = false;

    Chrome(function (chrome) {

        /**
         * Disable cache & clear cookies
         */
        chrome.Network.clearBrowserCache();
        chrome.Network.clearBrowserCookies();
        chrome.Network.requestServedFromCache(function (res) {
            debug('Served from cache:', res);
        });

        /**
         * Handle incoming requests
         */
        chrome.Network.requestWillBeSent(incomingRequest);

        function incomingRequest (params) {

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
            }
        }

        /**
         * Fired once when the page is ready
         */
        chrome.Page.loadEventFired(pageIsLoaded);

        function pageIsLoaded() {

            /**
             * Set the page load flag.
             * This is to indicate that we have enough resources cached
             * to build out the site
             * @type {boolean}
             */
            if (!items.length) {
                return;
            }

            pageload     = true;

            var filtered = utils.filterRequests(items, config);
            var conf     = { config: config, chrome: chrome };

            /**
             * Combine the download tasks of both the Text + Binary
             * files into a single array
             */
            /**
             * With the combined tasks from above, now download
             * the homepage & apply the rewrites
             */
            var stream = Rx.Observable
                .zip(dlText(filtered.text, conf), dlBin(filtered.bin, conf), concat)
                .concatMap(function (tasks) {
                    return getHomepage(filtered.home[0], conf, tasks);
                })
                .subscribe(function (val) {
                    write(config.indexOutput, val.home.rewritten);
                    if (config.cb) {
                        config.cb(null, val);
                    }
                }, function (err) {
                    config.cb(err);
                }, function () {
                    console.log('DONE');
                });
        }

        /**
         * Kick off
         */
        chrome.Network.enable();
        chrome.Page.enable();
        chrome.once('ready', function () {
            chrome.Page.navigate({'url': target.href});
        });

    }).on('error', function () {
        console.error('Cannot connect to Chrome');
    });
};

/**
 * Download the original document url & rewrite any links
 * present in the markup to be absolute paths instead
 * @param item
 * @param conf
 * @param tasks
 * @returns {*}
 */
function getHomepage (item, conf, tasks) {
    return dlOne(item, conf)
        .map(function (html) {
            return {
                chrome: conf.chrome,
                home: {
                    original: html,
                    rewritten: utils.applyTasks(html, tasks),
                    item: item
                },
                tasks: tasks,
                items: tasks
            }
        });
}