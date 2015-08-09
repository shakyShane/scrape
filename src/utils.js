var Download = require('download');
var write    = require('fs').writeFileSync;
var read     = require('fs').readFileSync;
var exists   = require('fs').existsSync;
var parse    = require('url').parse;
var resolve  = require('path').resolve;
var basename = require('path').basename;
var dirname  = require('path').dirname;
var extname  = require('path').extname;
var mkdirp   = require('mkdirp').sync;
var rmrf     = require('rimraf').sync;
var join     = require('path').join;
var debug    = require('debug')('scrape');
var Rx       = require('rx');
var utils    = exports;

/**
 * Write homepage to disk
 * @param {String} html - markup
 * @param {Array} tasks - rewrite tasks
 * @param {String} dest - full filename
 */
utils.writeWithTasks = function (html, tasks, dest) {

    write(dest, utils.applyTasks(html, tasks));

    return html;
};

/**
 * @param {String} input
 * @param {Array} tasks
 */
utils.applyTasks = function (input, tasks) {
    return tasks.reduce(function (all, item) {
        debug('Replacement', item.url.href, '\nwith:    ', item.url.path);
        all = all.replace(new RegExp(item.url.href, "gi"), item.url.path);
        return all;
    }, input);
};

/**
 * @param {Array} items
 * @param {Object} config
 * @param {Function} cb
 */
utils.downloadItemsAndWrite = function (items, opts, cb) {

    cb = cb || function () {};

    if (!Array.isArray(items)) {
        items = [items];
    }

    var dl       = new Download({mode: '755'});

    items.forEach(function (item) {
        var url = item.request.url;
        debug("DL:", extname(url), basename(url));
        dl.get(url, join(process.cwd(), opts.config.prefix, dirname(item.url.pathname)));
    });

    dl.run(function (err, files) {
        if (err) {
            return cb(err);
        }
        cb(null, files);
    });
};

/**
 * @param {Array} items
 * @param {Object} config
 * @param {Chrome} chrome
 * @param {Function} cb
 */
utils.downloadItems = function (items, opts, cb) {

    cb     = cb || function () {};
    var dl = new Download({mode: '755'});

    items.forEach(function (item) {
        dl.get(item.request.url);
    });

    dl.run(function (err, files) {
        if (err) {
            return cb(err);
        }
        cb(null, files);
    });
};

/**
 * @param chrome
 */
utils.chromeAsObservables = function (chrome) {

    var obj = {
        Network: {
            requestWillBeSent: Rx.Observable.create(function (obs) {
                chrome.Network.requestWillBeSent(function (params) {
                    obs.onNext(params);
                });
            })
        },
        Page: {
            loadEventFired: Rx.Observable.fromCallback(chrome.Page.loadEventFired)()
        }
    };

    return obj;
};
