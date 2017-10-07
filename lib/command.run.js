const Chrome      = require('chrome-remote-interface');
const Rx          = require('rx');
const url         = require('url');
const utils       = require('./utils');
const mkdirp      = require('mkdirp').sync;
const path        = require('path');
const debug       = require('debug')('scrape:jobs');
const download    = require('download');
const dirname     = require('path').dirname;
const mime        = require('mime');
const REQ_TIMEOUT = 20000;
const fs = require('fs-extra');
const {just, empty, concat, merge, fromPromise, fromNodeCallback} = Rx.Observable;

process.on('unhandledRejection', (reason) => {
    console.log('Reason: ' + reason);
    console.log(reason.stack);
});

const Right = x =>
    ({
        chain: f => f(x),
        map: f => Right(f(x)),
        fold: (f, g) => g(x),
        inspect: () => `Right(${x})`
    });

const Left = x =>
    ({
        chain: f => Left(x),
        map: f => Left(x),
        fold: (f, g) => f(x),
        inspect: () => `Left(${x})`
    });

const tryCatch = f => {
    try {
        return Right(f());
    } catch (e) {
        return Left(e);
    }
};

const mkdir = path =>
    tryCatch(() => fs.mkdir(path))
        .fold(e => Left(e), x => Right(x));

const readFile = path =>
    tryCatch(() => fs.readFileSync(path, 'utf8'))
        .fold(e => Left(e), x => Right(x));

const writeToDisk = (path, content) =>
    tryCatch(() => fs.writeFileSync(path, content))
        .fold(e => Left(e), x => Right(x));

const tryWrite = (path, content) => {
    return Right(path)
        .chain(dir => fs.existsSync(dirname(path)) ? Right(dir) : Left(dir))
        .fold(e => mkdir(dirname(path))
                .map(x => tryWrite(path, content)),
            x => writeToDisk(path, content)
                .map(x => x));
};

const pubPath = x => path.join.apply(null, [__dirname, '../', 'public'].concat(x));
const addUrl = req => {
    req.url = url.parse(req.request.url);
    return req;
}
const addOutputPaths = config => (req, i) => Right(req.url.pathname)
    .map(pathname => path.parse(pathname))
    .chain(parsed =>
        Right(parsed.dir.slice(1))
            .map(x => pubPath([config.target, x]))
            .map(dirname => ({
                dirname,
                filename: path.join(dirname, parsed.base),
                publicPath: path.join(parsed.dir, parsed.base),
                parsed,
                req,
                id: i
            })))
    .fold(e => e, x => x);


module.exports = function (cli) {

    const target = url.parse(cli.input[0]);
    const config = cli.flags;

    Chrome(function (chrome) {

        const obs = utils.chromeAsObservables(chrome);

        /**
         * Disable cache & clear cookies
         */
        chrome.Network.clearBrowserCache();
        chrome.Network.clearBrowserCookies();
        chrome.Network.requestServedFromCache(res => debug('Served from cache:', res));

        const events = new Rx.Subject();
        const noExt = obs.Network.responseReceived
            .map(x => {
                x.url = url.parse(x.response.url);
                return x;
            })
            .filter(x => x.type === 'XHR')
            .map(addOutputPaths(config))
            .filter(x => x.parsed.ext === '')
            .flatMap(x => {
                return fromPromise(chrome.Network.getResponseBody({requestId: x.req.requestId}))
                    .map(resp => {
                        return Object.assign({}, x, {resp})
                    })
            })
            .map(x => {
                if (mime.extension(x.req.response.mimeType) === 'json') {
                    return Object.assign({}, x, {resp: {body: JSON.stringify(JSON.parse(x.resp.body), null, 2)}})
                }
                return x;
            })
            .flatMap(x => {
                const ext = mime.extension(x.req.response.mimeType);
                return fs.outputFile(path.join(x.filename, `${x.id}.${ext}`), x.resp.body);
            })
            .ignoreElements();

        const reqs = obs.Network.requestWillBeSent
            .catch(x => {
                console.log('ERROR SWALLOWED');
                return Rx.Observable.empty();
            })
            .do(events)
            .map(req => {
                req.url = url.parse(req.request.url);
                return req;
            })
            .distinct(x => x.request.url)
            .filter(x => x.url.hostname === target.hostname)
            .map(addOutputPaths(config))
            .filter(x => x.parsed.ext !== '')
            .flatMap(x => {
                return fromPromise(download(x.req.request.url, x.dirname))
                    .map(dl => x)
            });

        const io$ = merge(noExt, reqs).takeUntil(
            merge(
                events
                    .debounce(REQ_TIMEOUT)
                    .do(x => console.log(`${REQ_TIMEOUT/1000} seconds of event silence occurred`)),
                Rx.Observable.fromEvent(process.stdin, 'data')
                    .map(x => x.toString())
                    .map(x => x.slice(0, -1))
                    .filter(x => x === 'q')
                    .take(1)
            )
        );

        /**
         * Begin listening to requests
         */
        Rx.Observable.concat(
            // log start
            just(true).do(() => console.log(`Listening for requests at ${target.href}`)).ignoreElements(),
            // gather all requests into a single array
            io$.toArray()
                // write json to disk for debugging
                .do(xs => fs.writeFileSync('xs.json', JSON.stringify(xs, null, 2)))
                // take the requests and rewrite index.html + CSS files with correct paths
                .flatMap(xs =>
                    // do CSS + index.html in parallel
                    merge(
                        // TODO - this could be different with AUTH etc.
                        fromPromise(download(target.href)) // write html
                            .do(x => console.log('rewriting HTML'))
                            .map(x => x.toString())
                            .map(x => rewriteHtml(x, xs))
                            .do(x => tryWrite(`public/${config.target}/index.html`, x)
                                .fold(e => console.error(e), x => x)
                            )
                            .do(x => console.log('doc length', x.length, 'assets downloaded', xs.length)),
                        // Filter reqs for CSS files, then do any replacements needed in them
                        Rx.Observable
                            .from(xs) // create observable with value for every request
                            .filter(x => x.parsed.ext === '.css') // filter for css
                            .do(x => console.log('rewriting CSS', x.filename)) // debug
                            .flatMap(css =>
                                Rx.Observable.create(obs => {
                                    Right(css.filename)
                                        .chain(filename   => readFile(filename)) // read css
                                        .map(file         => rewriteRelative(file, css.parsed.dir, xs)) // rewrite with relative paths
                                        .chain(newcontent => tryWrite(css.filename, newcontent)) // write back to disk
                                        .fold(e => obs.onError(e), x => obs.onCompleted());      // put error or success into the stream
                                })
                            )
                    )
                ),
            just(true).do(() => { // add a final step for closing chrome & process
                console.log('Closing Chrome & exiting');
                chrome.close();
                process.exit();
            })
        ).subscribe();

        /**
         * Connect ot chrome
         */
        Rx.Observable.merge(
            chrome.Network.enable(),
            chrome.Page.enable()
        )
            .do(() => chrome.Page.navigate({
                'url': target.href
            }))
            .subscribe();

    }).on('error', function (error) {
        console.error(error);
    });
};

function rewriteHtml (html, xs) {
    return xs.reduce((acc, item) => {
        return acc.replace(item.req.request.url, function () {
            return item.publicPath.slice(1);
        });
    }, html);
}

function rewriteRelative (css, filename, xs) {
    return xs.reduce((acc, item) => {
        return acc.replace(item.req.request.url, function () {
            return path.relative(filename, item.publicPath);
        });
    }, css);
}

module.exports.rewriteHtml = rewriteHtml;
