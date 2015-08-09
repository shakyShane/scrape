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

var downloadItems   = Rx.Observable.fromNodeCallback(utils.downloadItems);
var downloadItemsAndWrite = Rx.Observable.fromNodeCallback(utils.downloadItemsAndWrite);

module.exports = function (cli, config) {

    var target   = parse(cli.input[0]);
    var homeItem = {
        url: target,
        request: {
            url: target.href
        }
    };

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
        function isValidType (item, whitelist) {
            return whitelist.indexOf(extname(item.url.pathname)) > -1;
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
         * Download a single file & extract it's content only
         * @param item
         * @returns {*}
         */
        function singleFileContents (item) {
            return downloadItems([item], conf)
                .map(x => x[0]._contents.toString())
        }

        /**
         * Merge the text and binary request streams to
         * create a 'task' list that's used later to rewrite
         * links in the HTML for the homepage
         */
        netreq()
            .takeUntil(obs.Page.loadEventFired)
            .filter(x => isValidType(x, config.whitelist))
            .reduce((all, item) => all.concat(item), [])
            .flatMap(tasks => {
                return downloadItemsAndWrite(tasks, conf)
                    .map(files => {
                        return {
                            files: files,
                            tasks: tasks
                        }
                    });
            })
            /**
             * Now that we have all tasks + home page item,
             * download the homepage and rewrite the links in it.
             * Finish by constructing the Object that will be returned
             * to the public interface
             */
            .flatMap(obj => {
                return singleFileContents(homeItem).map(getReturnObj({tasks: obj.tasks, files: obj.files, homeItem}));
            })
            .map(x => {
                write(resolve(config.prefix, 'index.html'), x.home.rewritten);
                return x;
            })
            .subscribe(
                x => {
                    console.log(x.home);
                    config.cb(null, x);
                },
                config.cb // err handler
            );

        /**
         * Final handler. At this point:
         * 1. All requests leading upto the homepage have been downloaded
         * 2. The homepage HTML has been downloaded
         * 3. The homepage HTML has been rewritten to change
         *    remove scheme+domains
         */


        /**
         * Constuct the Object that is returned to the public API
         * @param obj
         * @returns {Function}
         */
        function getReturnObj(obj) {
            return function (html) {
                return {
                    config: config,
                    files: obj.files,
                    chrome: conf.chrome,
                    home: {
                        original: html,
                        rewritten: utils.applyTasks(html, obj.tasks),
                        item: obj.homeItem
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
