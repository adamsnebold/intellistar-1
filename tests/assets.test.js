const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const app = require('../app');

test('HTML, CSS and code are served without caching, including versioned theme requests', async t => {
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = await fetch(base);
    assert.equal(html.headers.get('cache-control'), 'no-store');
    const document = new JSDOM(await html.text()).window.document;
    const revision = document.querySelector('meta[name="asset-revision"]').content;
    const paths = [
        document.querySelector('link[href^="main.css"]').getAttribute('href'),
        document.querySelector('script[src^="js/themes.js"]').getAttribute('src'),
        `css/intellistar-32-2005-2006.css?v=${revision}`,
        `css/intellistar-32-2007.css?v=${revision}`
    ];
    for (const asset of paths) {
        assert.equal(new URL(asset, base).searchParams.get('v'), revision);
        const response = await fetch(`${base}/${asset}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const content = await response.text();
        if (asset.includes('2005-2006.css')) {
            assert.ok(content.includes(`sky.jpg?v=${revision}`));
            assert.ok(content.includes(`intellistar-32-2007.css?v=${revision}`));
            assert.match(content, /rgba\(17, 53, 130, \.72\)/);
        }
    }
    const sky = await fetch(`${base}/images/themes/2005-2006/sky.jpg?v=${revision}`);
    assert.equal(sky.status, 200);
    assert.equal(sky.headers.get('content-type'), 'image/jpeg');
    assert.ok((await sky.arrayBuffer()).byteLength > 1000);
    document.defaultView.close();
});

test('every first-party entry script shares the page asset revision', () => {
    const html = fs.readFileSync(path.join(__dirname, '../webroot/index.html'), 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const revision = document.querySelector('meta[name="asset-revision"]').content;
    for (const script of document.querySelectorAll('script[src]')) {
        const src = script.getAttribute('src');
        if (/^js\/[^/]+\.js/.test(src)) {
            assert.equal(new URL(src, 'http://localhost').searchParams.get('v'), revision);
        }
    }
    assert.equal(document.querySelectorAll('.theme-title-retro[hidden]').length, 3);
    dom.window.close();
});
