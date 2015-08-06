var Chrome   = require('chrome-remote-interface');
var parse    = require('url').parse;
var write    = require('fs').writeFileSync;
var basename = require('path').basename;
var dirname = require('path').dirname;
var extname = require('path').extname;
var mkdirp = require('mkdirp').sync;
var rmrf = require('rimraf').sync;
var resolve = require('path').resolve;
var whitelist = [".css", ".svg", ".html", ".js"];
var items     = [];
var target = parse("http://www.browsersync.io/docs/");
var prefix = "public";

rmrf(prefix);

setTimeout(function () {
    Chrome(function (chrome) {
        with (chrome) {
            Network.requestWillBeSent(function (params) {
                items.push(params);
            });
            Page.loadEventFired(function () {

                var home;

                // group resources by host
                items = items.map(function (item) {
                        item.url = parse(item.request.url);
                        return item;
                    })
                    .filter(function (item) {
                        return item.url.host === target.host;
                    })
                    .filter(function (item) {
                        if (item.request.url === item.documentURL) {
                            home = item;
                            return false;
                        }
                        return whitelist.indexOf(extname(item.url.pathname)) > -1;
                    });

                var count = 0;
                var len   = items.length;

                items.forEach(function (item) {

                    var output  = resolve(prefix, item.url.path.slice(1));
                    var _dirname = dirname(output);
                    mkdirp(_dirname);
                    Network.getResponseBody(item, function (err, resp) {
                        if (resp.base64Encoded) {
                            write(
                                output,
                                new Buffer(resp.body, 'base64').toString('ascii')
                            );
                        } else {
                            write(output, resp.body);
                        }
                        console.log('downloading:', item.url.path.slice(1), 'to', output);
                        count += 1;
                        if (count === len) {
                            Network.getResponseBody(home, function (err, resp) {
                                var home = resolve(prefix, 'index.html');
                                //console.log('downloading:', home.url.path.slice(1), 'to', home);
                                write(home, resp.body);
                                close();
                            });
                        }
                    });
                });
            });

            Network.enable();
            Page.enable();
            once('ready', function () {
                Page.navigate({'url': target.href});
            });
        }
    }).on('error', function () {
        console.error('Cannot connect to Chrome');
    });
}, 3000);
