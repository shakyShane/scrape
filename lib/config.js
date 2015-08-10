var resolve = require('path').resolve;
var join = require('path').join;
var conf = {};
var Immutable = require('immutable');

conf.prefix = 'public';

conf.whitelist = [".js", ".css", ".svg", ".html", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"];

conf.hostBlacklist = [];
conf.afterPageLoadTimeout = 2000;
conf.cwd = process.cwd();
conf.indexOutput = join(conf.cwd, conf.prefix, 'index.html');

conf.output = {
    dir: join(conf.cwd, conf.prefix)
};

module.exports = function (flags) {
    return Immutable
        .fromJS(conf)
        .mergeDeep(flags);
};

module.exports.merge = function (cli, opts) {};