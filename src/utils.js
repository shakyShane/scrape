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
var through2   = require('through2');
var rmrf     = require('rimraf').sync;
var join     = require('path').join;
var debug    = require('debug')('scrape');
var debugdl    = require('debug')('scrape:dl');
var debugvalid    = require('debug')('scrape:valid');
var debugtransform    = require('debug')('scrape:transform');
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
 * @param {String} outputDir
 * @param {Function} cb
 */
utils.downloadItemsAndWrite = function (obj, cb) {

    var items = obj.items;

    cb = cb || function () {};

    if (!Array.isArray(items)) {
        items = [items];
    }

    if (items.length === 0) {
        return cb();
    }

    var dl = new Download({mode: '755'});

    items.forEach(function (item) {
        var url = item.request.url;
        debugdl("DL:", url);
        if (item.downloadName) {
            dl.get(url, item.output.path)
                .rename(item.downloadName);
        } else {
            dl.get(url, item.output.path)
        }
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
 * @param {Function} cb
 */
utils.downloadItems = function (items, cb) {

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

/**
 * Filter requests by type
 * currently used extname, but could use mime types
 * etc if this proves unreliable
 * @param item
 * @param type
 * @param config
 * @returns {boolean}
 */
utils.isValidType = function (item, whitelist) {
    const ext = extname(item.url.pathname);
    var valid = whitelist.indexOf(extname(item.url.pathname)) > -1;

    if (!ext) {
        if (item.type === 'XHR') {
            valid = true;
        }
    }

    debugvalid(`${valid ? '+' : '-'} ${item.url.pathname}`);
    return valid;
};

/**
 * @param item
 * @param blacklist
 * @returns {boolean}
 */
utils.isExcludedHost = function (item, blacklist) {
    return blacklist.indexOf(item.url.host) > -1;
};

utils.transform = (item, transforms) => {
    if (!transforms) {
        return item;
    }
    return transforms.reduce(function (item, fn, transformPath) {
        if (item.url.path.match(new RegExp(`^${transformPath}`))) {
            return fn.call(null, item);
        }
        return item;
    }, item);
};
