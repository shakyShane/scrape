const xs = require('../../xs.json');
const fs = require('fs');
const html = require('fs').readFileSync('test/fixtures/index.html', 'utf8');
const css = require('fs').readFileSync('public/media/css_secure/3f4c87fe9382fe2927f6e785213a4f5b.css', 'utf8');
const rewrite = require('../../lib/jobs').rewriteHtml;

describe('rewriting HTML', function () {
    it('can swap CSS', function () {
        console.log(rewrite(css, xs));
    });
});
