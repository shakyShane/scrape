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

var downloadItems           = Rx.Observable.fromNodeCallback(utils.downloadItems);
var downloadItemsAndWrite   = Rx.Observable.fromNodeCallback(utils.downloadItemsAndWrite);
var writeFile               = Rx.Observable.fromNodeCallback(require('fs').writeFile);

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
         * Listen to incoming network requests
         * and add a parsed url for later use.
         * @returns {*}
         */
        function requestStream () {
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
            return downloadItems([item])
                .map(x => x[0]._contents.toString())
        }

        /**
         * Get the timeout that runs after the page is loaded
         * and collects the extra requests
         * @returns {*}
         */
        function afterPageLoadTimeout () {
            return obs.Page.loadEventFired.concat(Rx.Observable.defer(() => Rx.Observable.timer(config.afterPageLoadTimeout))).skip(1);
        }

        /**
         * Before Page load events
         */
        requestStream()
            /**
             * Take them until the page load event
             */
            .takeUntil(obs.Page.loadEventFired)
            /**
             * Filter to include only the files in the
             * config whitelist
             */
            .filter(x => utils.isValidType(x, config.whitelist))
            .filter(x => !utils.isExcludedHost(x, config.hostBlacklist))
            /**
             * Aggregate all to a flat array
             */
            .reduce((all, item) => all.concat(item), [])
            /**
             * User info logging
             */
            .do(x => console.log('=== Page load event fired ==='))
            .do(x => console.log('=== Waiting for a further ' + config.afterPageLoadTimeout + 'ms before exiting ==='))
            /**
             * Take the aggregated tasks and download each file
             * Return the tasks along with the vinyl objects
             */
            .flatMap(tasks => {
                return downloadItemsAndWrite(tasks, config.output.dir)
                    .map(files => {
                        return {
                            files: files,
                            tasks: tasks
                        }
                    });
            })
            /**
             * Now that all files are downloaded, we can fetch the markup
             * for the homepage and rewrite the links in it.
             * Finish by constructing the Object with the tasks, files and homepage
             * markup
             */
            .flatMap(obj => singleFileContents(homeItem).map(getReturnObj({tasks: obj.tasks, files: obj.files, homeItem})))
            /**
             * Final handler. At this point:
             * 1. All requests leading upto the homepage have been downloaded
             * 2. The homepage HTML has been downloaded
             * 3. The homepage HTML has been rewritten to change
             *    remove scheme+domains
             */
            .flatMap(x => writeFile(resolve(config.prefix, 'index.html'), x.home.rewritten).map(done => x))
            .subscribe(
                x => {
                    console.log('=== Files Downloaded & HTML rewritten ===');
                },
                (err) => {
                    console.error(err.message)
                }
            );

        /**
         * After page loaded request events
         */
        requestStream()
            .skipUntil(obs.Page.loadEventFired)
            .takeUntil(afterPageLoadTimeout())
            .reduce((all, item) => all.concat(item), [])
            .subscribe(x => {
                debug('>>> number of reqs after page load:', x.length);
                console.log('=== DONE now With after page-load requests');
                config.cb(null, x);
            },
            (err) => {
                console.error(err.message)
            }
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
                    files: obj.files,
                    chrome: conf.chrome,
                    home:   {
                        original:html,
                        rewritten: utils.applyTasks(html, obj.tasks),
                        item: obj.homeItem
                    },
                    tasks:  obj.tasks,
                    items:  obj.tasks
                }
            }
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
