var bs = require('/Users/shaneobsourne/code/browser-sync-core');

bs.create(
    {
        proxy: {
            target: "https://www.wearall.com",
            proxyReq: [function (req) {
                req.setHeader('Host', 'www.wearall.com');
            }]
        },
        serveStatic: 'public',
        watch: 'public'
    }
).subscribe(x => {
    console.log(x.options.get('urls'));
})
