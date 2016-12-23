const Rx = require('rx');
var scrape = require('./');
var bs     = require('browser-sync').create();
var rmrf   = require('rimraf').sync;

rmrf('public');

scrape({
    //input: ["http://m2.wearejh.com/fiona-fitness-short.html"],
    //input: ["http://m2.wearejh.com/women/bottoms-women/shorts-women.html"], // cat
    //input: ["http://m2.wearejh.com/men/bottoms-men.html"], // cat
    input: ["http://www.sunspel.com/uk/"], // catq

    flags: {
        afterPageLoadTimeout: 2000000000
    }
}, function (err, output) {

    var outputDir = output.config.getIn(['output', 'dir']);

    console.log('written to %s', outputDir);
});
//
// const item = {
//         "dirname": "/Users/shaneobsourne/code/scrape/public/media/css_secure",
//         "filename": "/Users/shaneobsourne/code/scrape/public/media/css_secure/4600a3e099676514db41859e4febd333.css",
//         "publicPath": "/media/css_secure/4600a3e099676514db41859e4febd333.css",
//         "parsed": {
//             "root": "/",
//             "dir": "/media/css_secure",
//             "base": "4600a3e099676514db41859e4febd333.css",
//             "ext": ".css",
//             "name": "4600a3e099676514db41859e4febd333"
//         },
//         "req": {
//             "requestId": "3950.17519",
//             "frameId": "3950.1",
//             "loaderId": "3950.266",
//             "documentURL": "https://staging.childsplayclothing.co.uk/",
//             "request": {
//                 "url": "https://staging.childsplayclothing.co.uk/media/css_secure/4600a3e099676514db41859e4febd333.css",
//                 "method": "GET",
//                 "headers": {
//                     "Referer": "https://staging.childsplayclothing.co.uk/",
//                     "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2960.0 Safari/537.36"
//                 },
//                 "mixedContentType": "none",
//                 "initialPriority": "VeryHigh"
//             },
//             "timestamp": 21141.278981,
//             "wallTime": 1482503852.27478,
//             "initiator": {
//                 "type": "parser",
//                 "url": "https://staging.childsplayclothing.co.uk/",
//                 "lineNumber": 16
//             },
//             "type": "Other",
//             "url": {
//                 "protocol": "https:",
//                 "slashes": true,
//                 "auth": null,
//                 "host": "staging.childsplayclothing.co.uk",
//                 "port": null,
//                 "hostname": "staging.childsplayclothing.co.uk",
//                 "hash": null,
//                 "search": null,
//                 "query": null,
//                 "pathname": "/media/css_secure/4600a3e099676514db41859e4febd333.css",
//                 "path": "/media/css_secure/4600a3e099676514db41859e4febd333.css",
//                 "href": "https://staging.childsplayclothing.co.uk/media/css_secure/4600a3e099676514db41859e4febd333.css"
//             }
//         },
//         "id": 1
//     };
//
// const css  = 'media/css_secure/4600a3e099676514db41859e4febd333.css';
// const font = 'skin/frontend/coolbaby/default/fonts/theme/avenir-next-regular.woff2';
// const path = require('path');
// console.log(path.relative(css, font))
// const font = 'https://staging.childsplayclothing.co.uk/skin/frontend/coolbaby/default/fonts/theme/baskerville.woff';
