var conf = exports;
var resolve       = require('path').resolve;

conf.prefix = 'public';
conf.whitelist = {
    text: [".js", ".css", ".svg", ".html"],
    bin: [".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"]
};

conf.homepath = resolve(conf.prefix, 'index.html');