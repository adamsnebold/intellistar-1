const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads the regional module with stubs for the DOM and slide scheduler, then
// checks the fixed product order and the pure forecast helpers.
// Values created inside the VM context use another realm's prototypes; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

function loadRegional() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'webroot/js/regional-2005.js'), 'utf8');
    const context = {
        $: () => ({}),
        slidePrograms: {},
        document: { documentElement: { dataset: {} } },
        Date,
        console,
        api_key: 'test',
        setTimeout,
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

test('regional order: five Monday, five three-day, six radar, one thunderstorm', () => {
    const ctx = loadRegional();
    const flavor = vm.runInContext('regionalFlavor', ctx);
    const kinds = plain(flavor.order.map(item => [item.function, item.slides || 1]));
    assert.deepEqual(kinds, [
        ['regionalMonday', 5],
        ['regionalThreeDay', 5],
        ['regionalRadar', 6],
        ['regionalThunder', 1],
    ]);
});

test('Monday slides hold four cities each; the Pacific slide uses 3, 6, and 9 pm', () => {
    const ctx = loadRegional();
    const monday = vm.runInContext('REGIONAL_MONDAY_SLIDES', ctx);
    assert.equal(monday.length, 5);
    monday.forEach(group => assert.equal(group.cities.length, 4));
    assert.deepEqual(plain(monday[3].hours), [15, 18, 21]);
    assert.deepEqual(plain(monday[0].hours), [18, 21, 0]);
});

test('three-day slides list four cities each, all in the city table', () => {
    const ctx = loadRegional();
    const names = new Set(vm.runInContext('REGIONAL_CITIES', ctx).map(c => c.name));
    const threeDay = vm.runInContext('REGIONAL_THREE_DAY_SLIDES', ctx);
    assert.equal(threeDay.length, 5);
    threeDay.forEach(slide => {
        assert.equal(slide.length, 4);
        slide.forEach(name => assert.ok(names.has(name), name));
    });
});

test('radar regions are the six requested, each with valid bounds', () => {
    const ctx = loadRegional();
    const regions = plain(vm.runInContext('REGIONAL_RADAR_REGIONS', ctx).map(r => r.name));
    assert.deepEqual(regions, ['Northeast', 'Southeast', 'Midwest', 'South', 'Southwest', 'Northwest']);
    for (const region of vm.runInContext('REGIONAL_RADAR_REGIONS', ctx)) {
        const [w, s, e, n] = region.bounds;
        assert.ok(w < e && s < n, region.name);
    }
});

test('hour labels follow the reference wording', () => {
    const ctx = loadRegional();
    assert.equal(vm.runInContext("regionalHourLabel(18)", ctx), '6 pm');
    assert.equal(vm.runInContext("regionalHourLabel(21)", ctx), '9 pm');
    assert.equal(vm.runInContext("regionalHourLabel(0)", ctx), 'Midnight');
    assert.equal(vm.runInContext("regionalHourLabel(15)", ctx), '3 pm');
});

test('period picking moves forward so midnight lands after the evening', () => {
    const ctx = loadRegional();
    const entries = [
        { date: '2026-10-15', hour: 18, temp: 70 },
        { date: '2026-10-15', hour: 21, temp: 66 },
        { date: '2026-10-16', hour: 0, temp: 62 },
    ];
    ctx.entries = entries;
    const picked = vm.runInContext('regionalPeriods(entries, [18, 21, 0])', ctx);
    assert.deepEqual(plain(picked.map(p => p.temp)), [70, 66, 62]);
    const missing = vm.runInContext('regionalPeriods(entries, [18, 21, 0, 3])', ctx);
    assert.equal(missing[3], null);
});

test('theme registration keeps the 2005 base and its own stylesheet', () => {
    const themes = fs.readFileSync(path.join(__dirname, '..', 'webroot/js/themes.js'), 'utf8');
    assert.match(themes, /'2005-regional': \{ label: '2005 Regional', base: '2005-2006', stylesheet: '2005-regional'/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'webroot/css/intellistar-32-2005-regional.css')));
});

test('radar prefetch: tile coordinates match the standard web-mercator grid', () => {
    const ctx = loadRegional();
    // Dallas at zoom 5 is tile column 7, row 12 on the 32 x 32 grid.
    assert.equal(ctx.regionalLonToTileX(-96.797, 5), 7);
    assert.equal(ctx.regionalLatToTileY(32.7767, 5), 12);
});

test('radar prefetch: one URL per tile per frame, in the source URL format', () => {
    const ctx = loadRegional();
    // Bounds one degree either side of 0,0 at map zoom 7 (tile zoom 6) cover a 2 x 2 tile block.
    const urls = plain(ctx.regionalTileUrls([-1, -1, 1, 1], 7, [1000, 2000], 'test'));
    assert.equal(urls.length, 8);
    for (const url of urls) {
        assert.match(url, /^https:\/\/api\.weather\.com\/v3\/TileServer\/tile\/twcRadarMosaic\?ts=\d+&xyz=\d+:\d+:6&apiKey=test$/);
    }
});

test('radar prefetch: tile zoom is clamped to the raster source range', () => {
    const ctx = loadRegional();
    const low = plain(ctx.regionalTileUrls([-1, -1, 1, 1], 2, [1], 'test'));
    assert.ok(low.every(url => url.endsWith(':5&apiKey=test')));
    const high = plain(ctx.regionalTileUrls([-1, -1, 1, 1], 30, [1], 'test'));
    assert.ok(high.every(url => url.endsWith(':12&apiKey=test')));
});

test('radar prefetch: requests are capped per refresh', () => {
    const ctx = loadRegional();
    const timestamps = Array.from({ length: 200 }, (_, i) => i + 1);
    const urls = plain(ctx.regionalTileUrls([-125, 24, -66, 50], 12, timestamps, 'test'));
    assert.equal(urls.length, 600);
});

test('regional radar hold: reveals at once when the base map and one frame are ready', () => {
    const ctx = loadRegional();
    const map = { isStyleLoaded: () => true, getStyle: () => ({ sources: { base: {}, radar_1: {} } }), isSourceLoaded: () => true };
    ctx.window = { regradar: map };
    ctx.radarState = () => ({ timestamps: [1] });
    ctx.radarFrameReady = () => true;
    const calls = [];
    const group = { css: (...args) => { calls.push(args); return group; } };
    ctx.regionalHoldUntilReady(group);
    assert.deepEqual(plain(calls), [['visibility', '']]);
});

test('regional radar hold: reveals at the cap when the base map never finishes', async () => {
    const ctx = loadRegional();
    const map = { isStyleLoaded: () => true, getStyle: () => ({ sources: { base: {} } }), isSourceLoaded: () => false };
    ctx.window = { regradar: map };
    ctx.radarState = () => ({ timestamps: [] });
    ctx.radarFrameReady = () => false;
    const calls = [];
    const group = { css: (...args) => { calls.push(args); return group; } };
    ctx.regionalHoldUntilReady(group);
    assert.equal(calls.length, 0, 'stays hidden while waiting');
    await new Promise(resolve => setTimeout(resolve, 2700));
    assert.deepEqual(plain(calls), [['visibility', '']]);
});
