function concat (x, y) { return x.concat(y) }
var Chrome   = require('chrome-remote-interface');
var Download = require('download');
var parse    = require('url').parse;
var debug    = require('debug')('scrape');
var debugxhr    = require('debug')('scrape:xhr');
var debugtime    = require('debug')('scrape:time');
var resolve  = require('path').resolve;
var write    = require('fs').writeFileSync;
var read     = require('fs').readFileSync;
var dirname  = require('path').dirname;
var extname  = require('path').extname;
var exists   = require('fs').existsSync;
var basename = require('path').basename;
var join     = require('path').join;
var utils    = require('./utils');
var Rx       = require('rx');
var items    = [];
var debugdl    = require('debug')('scrape:dl');

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
                .map((req, i) => {
                    req.url = parse(req.request.url);
                    req._i = i;
                    req.errors = [];
                    if (req.type === 'XHR') {
                        debugxhr(`+ ${req.url.pathname}`);
                    }
                    req.output = {
                        path: join(config.getIn(['output', 'dir']), dirname(req.url.pathname)),
                        filename: basename(req.url.pathname)
                    };
                    return req;
                });
        }

        obs.Network.responseReceived
            .filter(x => x.response.url.indexOf('uenc') > -1)
            .subscribe(x => {
                chrome.Network.getResponseBody(x, function (output, here) {
                    console.log(x.response.url);
                    console.log(here.body);
                })
            });

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
        const afterPageLoadTimer = () => Rx.Observable.defer(() => {
            return Rx.Observable.timer(config.get('afterPageLoadTimeout'))
        });

        const pageLoadedEvent$ = new Rx.BehaviorSubject(false);

        const pageLoadPlusTimeout$ = obs.Page.loadEventFired
            .concat(afterPageLoadTimer())
            .skip(1);

        obs.Page.loadEventFired.subscribe(pageLoadedEvent$);

        /**
         * Before Page load events
         */
        var beforePageLoad = requestStream()
            /**
             * Take them until the page load event
             */
            .takeUntil(pageLoadPlusTimeout$)
            //.take(1)
            /**
             * Filter to include only the files in the
             * config whitelist
             */
            .filter(x => utils.isValidType(x, config.get('whitelist')))
            .filter(x => !utils.isExcludedHost(x, config.get('hostBlacklist')))
            .map(x => utils.transform(x, config.get('transforms')))
            .withLatestFrom(pageLoadedEvent$, (item, loaded) => {
                item.loaded = loaded ? 'after' : 'before';
                return item;
            })
            /**
             * Take the aggregated tasks and download each file
             * Return the tasks along with the vinyl objects
             */
            .flatMap(item => {

                var Download = require('download');
                var dl = new Download({mode: '755'});
                var url = item.request.url;

                debugdl(`+ : [${item._i}] ${url}`);

                if (item.downloadName) {
                    dl.get(url, item.output.path)
                        .rename(item.downloadName);
                } else {
                    dl.get(url, item.output.path)
                }

                return Rx.Observable.create(obs => {
                    dl.run(function (err, files) {
                        if (err) {
                            item.errors.push({type: 'DOWNLOAD_FAIL'});
                            debugdl(`- FAIL :`, url);
                        } else {
                            debugdl(`✔ : [${item._i}] ${item.output.filename}`);
                        }
                        item.download = files;
                        obs.onNext(item);
                        obs.onCompleted();
                    });
                });
            })
            /**
             * Ensure all items complete
             */
            .toArray();

        /**
         * Now zip both before and after events
         */
        Rx.Observable
            .zip(beforePageLoad, (before) => {
                return before;
            })
            .subscribe(
                x => {
                    //console.log('reqs', x.length);
                    //x.forEach(function (item) {
                    //    console.log(item.loaded);
                    //})
                    const success = x.filter(x => !x.errors.length);
                    const fails = x.filter(x => x.errors.length);
                    console.log('good:', success.length);
                    console.log('bad:', fails.length);

                    chrome.close();
                    config.get('cb')(null, {
                        config: config
                    });
                },
                err => {
                    console.log(err.stack);
                    console.log('got error');
                    //chrome.close();
                    //throw err;
                },
                s => {
                    //console.log('>>> number of req BEFORE page load:', x.before.tasks.length);
                    //console.log('>>> number of req AFTER  page load:', x.after.length);

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
                    //chrome: conf.chrome,
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
