var write    = require('fs').writeFileSync;
var read     = require('fs').readFileSync;
var exists   = require('fs').existsSync;
var basename = require('path').basename;
var dirname  = require('path').dirname;
var extname  = require('path').extname;
var mkdirp   = require('mkdirp').sync;
var rmrf     = require('rimraf').sync;
var debug    = require('debug')("scrape:utils");
var join     = require('path').join;
var conf     = require('./config')();
var debug    = require('debug')('scrape');
var utils    = exports;

utils.filterRequests = function (items) {
    if (!Array.isArray(items)) {
        items = [items];
    }
    return items.reduce(function (all, item) {
        var ext = extname(item.url.pathname);
        if (item.request.url === item.documentURL) {
            all.home.push(item);
            return all;
        }
        if (conf.whitelist.text.indexOf(ext) > -1) {
            all.text.push(item);
        }
        if (conf.whitelist.bin.indexOf(ext) > -1) {
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

    tasks.forEach(function (item) {
        debug('replacing:', item.url.href, '\n       with:    ', item.url.path);
        html = html.replace(new RegExp(item.url.href, "gi"), item.url.path);
    });

    write(dest, html);

    return html;
};

/**
 * Download a bunch of binary files
 * @param items
 * @param cb
 */
utils.downloadBin = function (items, cb) {

    cb = cb || function () {};
    var Download = require('download');
    var dl       = new Download({mode: '755'});
    items.forEach(function (item) {
        debug("DL bin:", extname(item.request.url), basename(item.request.url));
        dl.get(item.request.url, join(process.cwd(), conf.prefix, dirname(item.url.pathname)));
    });

    dl.run(function (err, files) {
        if (err) {
            return cb(err);
        }
        cb(null, items);
    });
};