var resolve = require('path').resolve;
var join = require('path').join;
var conf = {};

conf.prefix = 'public';

conf.whitelist = [".js", ".css", ".svg", ".html", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"];

conf.cwd = process.cwd();
conf.indexOutput = join(conf.cwd, conf.prefix, 'index.html');

module.exports = function (cli, opts) {
    return conf;
};

module.exports.merge = function (cli, opts) {};