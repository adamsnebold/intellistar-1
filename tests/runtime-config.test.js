const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');
const { JSDOM } = require('jsdom');
const app = require('../app');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function restoreEnv(name, value) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

test('runtime config exposes only public Mapbox tokens, with no caching or dotenv download', async t => {
    const original = process.env.MAPBOX_ACCESS_TOKEN;
    const other = process.env.TEST_PRIVATE_SETTING;
    t.after(() => {
        restoreEnv('MAPBOX_ACCESS_TOKEN', original);
        restoreEnv('TEST_PRIVATE_SETTING', other);
    });
    process.env.TEST_PRIVATE_SETTING = 'do-not-send-this';
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [token, expected] of [
        ['pk.test-public-token', 'pk.test-public-token'],
        ['  pk.test-public-token  ', 'pk.test-public-token'],
        ['', ''], ['sk.test-secret-token', ''], ['pk.invalid";alert(1)//', '']
    ]) {
        process.env.MAPBOX_ACCESS_TOKEN = token;
        const response = await fetch(`${base}/runtime-config.js?v=test`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /javascript/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const body = await response.text();
        const context = vm.createContext({ window: {} });
        vm.runInContext(body, context);
        const config = context.window.INTELLISTAR_CONFIG;
        assert.deepEqual(Object.keys(config), ['mapboxAccessToken']);
        assert.equal(config.mapboxAccessToken, expected);
        assert.ok(!body.includes('do-not-send-this'));
        assert.ok(!body.includes('sk.test-secret-token'));
    }
    for (const file of ['.env', '.env.example']) {
        assert.equal((await fetch(`${base}/${file}`)).status, 404);
    }
});

test('runtime script loads before config and supplies every Mapbox map instance', async () => {
    const dom = new JSDOM(read('webroot/index.html'));
    const scripts = [...dom.window.document.querySelectorAll('script[src]')].map(script => script.getAttribute('src'));
    const runtimeIndex = scripts.findIndex(src => src.startsWith('runtime-config.js'));
    assert.ok(runtimeIndex >= 0 && runtimeIndex < scripts.findIndex(src => src.startsWith('js/config.js')));
    const maps = [];
    const mapboxgl = {
        Map: class {
            constructor(options) {
                maps.push({ options, accessToken: mapboxgl.accessToken });
            }
            on() {}
            isStyleLoaded() { return false; }
        }
    };
    const context = vm.createContext({
        window: { INTELLISTAR_CONFIG: { mapboxAccessToken: 'pk.browser-test-token' } },
        mapboxgl, document: dom.window.document,
        locationConfig: { mainCity: { lon: -123.26, lat: 44.56 } },
        setTimeout() {}
    });
    vm.runInContext(read('webroot/js/config.js'), context);
    vm.runInContext(read('webroot/js/radar.js'), context);
    assert.equal(context.map_key, 'pk.browser-test-token');
    assert.equal(mapboxgl.accessToken, context.map_key);
    await vm.runInContext('createMaps()', context);
    assert.equal(maps.length, 8);
    assert.equal(dom.window.document.querySelector('.radar').style.display, 'none');
    dom.window.close();
    assert.deepEqual(maps.map(map => map.options.container), [
        'regradar', 'regmap', 'regoutlines', 'regoutlinestrans',
        'locradar', 'locmap', 'locoutlines', 'locoutlinestrans'
    ]);
    for (const map of maps) {
        assert.equal(map.accessToken, context.map_key);
        assert.equal(map.options.interactive, false);
        assert.equal(map.options.trackResize, false);
        assert.equal(map.options.fadeDuration, 0);
        assert.match(map.options.style, /^mapbox:\/\/styles\//);
    }
});

test('static fallback and missing config remain safe and leave settings open on Start', async () => {
    for (const hasFallback of [true, false]) {
        const messages = [];
        const context = vm.createContext({
            window: {}, document: { addEventListener() {} },
            alert(message) { messages.push(message); }
        });
        if (hasFallback) vm.runInContext(read('webroot/runtime-config.js'), context);
        vm.runInContext(read('webroot/js/config.js'), context);
        vm.runInContext(read('webroot/js/settings.js'), context);
        assert.equal(context.map_key, '');
        await vm.runInContext('startProgram()', context);
        assert.equal(context.inSettings, true);
        assert.equal(messages.length, 1);
        assert.match(messages[0], /MAPBOX_ACCESS_TOKEN/);
    }
});
