var resolve       = require('path').resolve;
var conf = {};

conf.prefix = 'public';

conf.whitelist = {
    text: [".js", ".css", ".svg", ".html"],
    bin: [".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"]
};

module.exports = function (cli, opts) {
    return conf;
};

module.exports.merge = function (cli, opts) {

};



