const Chrome      = require('chrome-remote-interface');
const Rx          = require('rx');
const url         = require('url');
const utils       = require('./utils');
const path        = require('path');
const debug       = require('debug')('scrape:jobs');
const debugReq       = require('debug')('scrape:requestWillBeSent');
const download    = require('download');
const dirname     = require('path').dirname;
const mime        = require('mime-types');
const fs = require('fs-extra');
const {just, of, empty, merge, fromPromise} = Rx.Observable;

const defaults = {
    target: 'index',
    afterPageLoadTimeout: 5000,
    cwd: process.cwd(),
    domains: [],
}

process.on('unhandledRejection', (reason) => {
    console.log('Reason: ' + reason);
    console.log(reason.stack);
});


module.exports = function (cli, internalConfig, cb) {

    const target = url.parse(cli.input[1]);
    const config = Object.assign({}, defaults, cli.flags);
    const domains = [].concat(config.domains).filter(Boolean);


    Chrome({port: internalConfig.port}, function (chrome) {

        const obs = utils.chromeAsObservables(chrome);

        /**
         * Disable cache & clear cookies
         */
        chrome.Network.clearBrowserCache();
        chrome.Network.clearBrowserCookies();
        chrome.Network.requestServedFromCache(res => debug('Served from cache:', res));

        const events = new Rx.Subject();

        const reqs = obs.Network.responseReceived
            .catch(x => {
                return Rx.Observable.empty();
            })
            .do(events)
            .map(req => {
                req.url = url.parse(req.response.url);
                return req;
            })
            .distinct(x => x.response.url)
            .filter(x => {
                if (x.url.hostname === target.hostname) {
                    return true;
                }
                if (domains.indexOf(x.url.hostname) > -1) {
                    return true;
                }
                return false;
            })

        // const resps = obs.Network.responseReceived
        //     .do(x => debugReq(x.response.url))
        //     .catch(x => empty())

        const io$ = reqs.takeUntil(
            Rx.Observable.fromEvent(process.stdin, 'data')
                .map(x => x.toString())
                .map(x => x.slice(0, -1))
                .filter(x => x === 'q')
                .take(1)
        );

        /**
         * Begin listening to requests
         */
        Rx.Observable.concat(
            // log start
            just(true).do(() => console.log(`Listening for requests at ${target.href}`)).ignoreElements(),
            // gather all requests into a single array
            io$.toArray().do((x) => fs.writeFileSync('out.json', JSON.stringify(x, null, 2))),
            just(true).do(() => { // add a final step for closing chrome & process
                console.log('Closing Chrome Interface');
                chrome.close();
                cb(null);
            })
        )
            .catch(err => {
                cb(err);
                return empty();
            })
            .subscribe();

        Rx.Observable.merge(
            chrome.Network.enable(),
            chrome.Page.enable()
        )
            .toArray()
            .do(() => {
                chrome.Page.navigate({
                    'url': target.href
                })
                console.log('navigating to ' + target.href);
            })
            .subscribe();

    }).on('error', cb);
};