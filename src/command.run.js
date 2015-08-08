function concat (x, y) { return x.concat(y) }
var Chrome   = require('chrome-remote-interface');
var parse    = require('url').parse;
var debug    = require('debug')('scrape');
var resolve  = require('path').resolve;
var write    = require('fs').writeFileSync;
var read     = require('fs').readFileSync;
var extname  = require('path').extname;
var exists   = require('fs').existsSync;
var basename = require('path').basename;
var join     = require('path').join;
var utils    = require('./utils');
var Rx       = require('rx');
var items    = [];

var downloadTextItems   = Rx.Observable.fromNodeCallback(utils.downloadText);
var downloadBinaryItems = Rx.Observable.fromNodeCallback(utils.downloadBin);
var downloadTextItem    = Rx.Observable.fromNodeCallback(utils.downloadOne);

module.exports = function (cli, config) {

    var target   = parse(cli.input[0]);

    Chrome(function (chrome) {

        var obs  = utils.chromeAsObservables(chrome);
        var conf = { config: config, chrome: chrome };

        /**
         * Disable cache & clear cookies
         */
        chrome.Network.clearBrowserCache();
        chrome.Network.clearBrowserCookies();
        chrome.Network.requestServedFromCache(res => debug('Served from cache:', res));

        /**
         * Filter requests by type
         * currently used extname, but could use mime types
         * etc if this proves unreliable
         * @param item
         * @param type
         * @param config
         * @returns {boolean}
         */
        function isType (item, type, config) {
            return config.whitelist[type].indexOf(extname(item.url.pathname)) > -1;
        }

        /**
         * Listen to incoming network requests
         * and add a parsed url for later use.
         * @returns {*}
         */
        function netreq () {
            return obs.Network.requestWillBeSent
                .map(req => {
                    req.url = parse(req.request.url);
                    return req;
                });
        }

        /**
         * Create a Download Observable
         * that returns an array of items
         * it downloaded
         * @param type
         * @param fn
         */
        function createDownloaderByType(type, fn) {
            return netreq()
                .takeUntil(obs.Page.loadEventFired)
                .filter(x => isType(x, type, config))
                .reduce((all, item) => all.concat(item), [])
                .flatMap(items => {
                    return fn(items, conf);
                });
        }

        /**
         * Create observables that are listening
         * until the page load event is called.
         * They each download either the text or binary files
         * asked for and they each return the request obj used.
         * @type {Observable.<R>}
         */
        var textRequests   = createDownloaderByType('text', downloadTextItems);
        var binaryRequests = createDownloaderByType('bin', downloadBinaryItems);

        /**
         * Capture the single request that is the page
         * given in config
         */
        var home = netreq()
            .takeUntil(obs.Page.loadEventFired)
            .filter(x => x.request.url === x.documentURL);

        /**
         * Merge the text and binary request streams to
         * create a 'task' list that's used later to rewrite
         * links in the HTML for the homepage
         * @type {Rx.Observable<T>|Rx.Observable<Array>}
         */
        var tasks = Rx.Observable
            .merge(textRequests, binaryRequests)
            .reduce((all, item) => all.concat(item), []);

        /**
         * Combine the homepage request item with the merged
         * tasks from above so that we can do some overwriting.
         */
        var initial = Rx.Observable.combineLatest(tasks, home, function (tasks, home) {
            return {
                tasks: tasks,
                home: home
            };
        })
        /**
         * Now that we have all tasks + home page item,
         * download the homepage and rewrite the links in it.
         * Finish by constructing the Object that will be returned
         * to the public interface
         */
        .flatMap(obj => downloadTextItem(obj.home, conf).map(getReturnObj(obj)));

        /**
         * Final handler. At this point:
         * 1. All requests leading upto the homepage have been downloaded
         * 2. The homepage HTML has been downloaded
         * 3. The homepage HTML has been rewritten to change
         *    remove scheme+domains
         */

        var writer = initial
            .subscribe(
                x => {
                    write(resolve(x.config.prefix, 'index.html'), x.home.rewritten);
                    config.cb(null, x);
                },
                config.cb // err handler
            );

        /**
         * Constuct the Object that is returned to the public API
         * @param obj
         * @returns {Function}
         */
        function getReturnObj(obj) {
            return function (html) {
                return {
                    config: config,
                    chrome: conf.chrome,
                    home: {
                        original: html,
                        rewritten: utils.applyTasks(html, obj.tasks),
                        item: obj.home
                    },
                    tasks: obj.tasks,
                    items: obj.tasks
                }
            }
        }


        //obs.incoming
        //    .skipUntil(obs.pageLoaded)
        //    .subscribe(function (req) {
        //        console.log('a new req for:', req.url.href);
        //        //console.log('REQ', req.url.href);
        //    }, function (err) {
        //        console.log(err);
        //    }, function () {
        //        console.log('done');
        //    });

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
