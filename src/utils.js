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
 * @param {Array} items
 * @param {Object} config
 * @returns {Object}
 */
utils.filterRequests = function (items, config) {
    if (!Array.isArray(items)) {
        items = [items];
    }
    return items.reduce(function (all, item) {
        var ext = extname(item.url.pathname);
        if (item.request.url === item.documentURL) {
            all.home.push(item);
            return all;
        }
        if (config.whitelist.text.indexOf(ext) > -1) {
            all.text.push(item);
        }
        if (config.whitelist.bin.indexOf(ext) > -1) {
            all.bin.push(item);
        }
        return all;
    }, {text: [], bin: [], home: []});
};

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
utils.downloadBin = function (items, opts, cb) {

    cb           = cb || function () {};
    var Download = require('download');
    var dl       = new Download({mode: '755'});
    items.forEach(function (item) {
        debug("DL bin:", extname(item.request.url), basename(item.request.url));
        dl.get(item.request.url, join(process.cwd(), opts.config.prefix, dirname(item.url.pathname)));
    });

    dl.run(function (err) {
        if (err) {
            return cb(err);
        }
        cb(null, items);
    });
};

/**
 * @param {Array} items
 * @param {Object} config
 * @param {Chrome} chrome
 * @param {Function} cb
 */
utils.downloadText = function (items, opts, cb) {

    var count        = 0;
    cb               = cb || function () {};
    var len          = items.length;
    var rewriteTasks = [];

    items.forEach(function (item) {

        var output   = resolve(opts.config.prefix, item.url.pathname.slice(1));
        var _dirname = dirname(output);
        mkdirp(_dirname);

        opts.chrome.Network.getResponseBody(item, function (err, resp) {

            if (err) {
                return cb(err);
            }

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
};

/**
 * @param {Object} opts
 * @param {Function} cb
 */
utils.downloadOne = function (item, opts, cb) {
    opts.chrome.Network.getResponseBody(item, function (err, resp) {
        if (err) {
            return cb(err);
        }
        cb(null, resp.body);
    });
};

/**
 * @param chrome
 */
utils.asObservables = function (chrome) {
    var incoming = Rx.Observable.create(function (obs) {
        chrome.Network.requestWillBeSent(function (params) {
            obs.onNext(params);
        });
    }).map(req => {
        req.url = parse(req.request.url);
        return req;
    });

    return {
        pageLoaded: Rx.Observable.fromCallback(chrome.Page.loadEventFired)(),
        incoming: incoming
    }
};