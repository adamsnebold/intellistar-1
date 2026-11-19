const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

class FakeMap extends EventEmitter {
    constructor() {
        super();
        this.sources = new Map();
        this.layers = new Map();
        this.ready = new Set();
        this.styleReady = true;
        this.paints = [];
    }
    isStyleLoaded() { return this.styleReady; }
    getSource(id) { return this.sources.get(id); }
    getLayer(id) { return this.layers.get(id); }
    addSource(id, source) { this.sources.set(id, source); }
    addLayer(layer) { this.layers.set(layer.id, layer); }
    removeSource(id) { this.sources.delete(id); }
    removeLayer(id) { this.layers.delete(id); }
    getStyle() { return { layers: [...this.layers.values()] }; }
    isSourceLoaded(id) { return this.ready.has(id); }
    setPaintProperty(id, key, value) {
        this.layers.get(id).paint[key] = value;
        this.paints.push({ id, key, value });
    }
    markReady(...timestamps) { timestamps.forEach(ts => this.ready.add(`radar_${ts}`)); }
    visible() { return [...this.layers.values()].filter(layer => layer.paint['raster-opacity'] === 1).map(layer => layer.id); }
}

function setup(t) {
    const frames = new Map(), timers = new Map();
    let id = 0;
    const dom = new JSDOM(read('webroot/index.html'), { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const w = dom.window;
    let hidden = false;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    Object.assign(w, {
        mapboxgl: { accessToken: '', Map: FakeMap }, map_key: 'pk.test', api_key: 'test',
        weatherInfo: {}, AbortController,
        requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
        cancelAnimationFrame(handle) { frames.delete(handle); },
        setTimeout(callback, delay) { timers.set(++id, { callback, delay }); return id; },
        clearTimeout(handle) { timers.delete(handle); },
        fetch: async () => ({ ok: true, json: async () => ({ seriesInfo: { twcRadarMosaic: { series: [{ ts: 3 }, { ts: 1 }, { ts: 2 }, { ts: 2 }] } } }) })
    });
    vm.runInContext(read('webroot/js/radar.js'), dom.getInternalVMContext());
    return {
        w, frames, timers, dom,
        tick(now) {
            const pending = [...frames.values()]; frames.clear();
            pending.forEach(callback => callback(now));
        },
        hide(value) { hidden = value; }
    };
}

async function populated(w) {
    const map = new FakeMap();
    await w.addRadarLayers(map, [1, 2, 3]);
    return map;
}

test('frames preload at zero opacity, with no raster or opacity fades', async t => {
    const { w } = setup(t);
    const map = await populated(w);
    assert.equal(map.sources.size, 3);
    for (const layer of map.layers.values()) {
        assert.equal(layer.layout.visibility, 'visible', 'hidden layers would not request tiles');
        assert.equal(layer.paint['raster-opacity'], 0);
        assert.equal(layer.paint['raster-fade-duration'], 0);
        assert.equal(layer.paint['raster-opacity-transition'].duration, 0);
    }
    await w.addRadarLayers(map, [1, 2, 3]);
    assert.equal(map.sources.size, 3, 'reusing a preload does not duplicate sources');
});

test('playback waits for complete tiles, skips failed frames, and retains the last good image', async t => {
    const { w, tick } = setup(t);
    const map = await populated(w);
    w.animateRadar(map, [1, 2, 3]);
    tick(0);
    assert.deepEqual(map.visible(), []);
    assert.equal(w.weatherInfo.radarUnavailable, true);
    map.markReady(1);
    tick(100);
    assert.deepEqual(map.visible(), ['radarlayer_1']);
    map.markReady(2, 3);
    map.emit('error', { sourceId: 'radar_2' });
    tick(1100);
    assert.deepEqual(map.visible(), ['radarlayer_3']);
    assert.deepEqual(map.paints.slice(-2).map(p => [p.id, p.value]), [['radarlayer_3', 1], ['radarlayer_1', 0]]);
    map.ready.clear();
    tick(2100);
    assert.deepEqual(map.visible(), ['radarlayer_3'], 'loading never clears the previous complete image');
    assert.equal(w.weatherInfo.radarUnavailable, false);
});

test('one RAF loop preserves 12 fps and the final-frame hold, with no catch-up bursts', async t => {
    const { w, tick, frames, hide } = setup(t);
    const map = await populated(w);
    map.markReady(1, 2, 3);
    w.animateRadar(map, [1, 2, 3]);
    tick(0); assert.deepEqual(map.visible(), ['radarlayer_1']);
    tick(50); assert.deepEqual(map.visible(), ['radarlayer_1']);
    tick(84); assert.deepEqual(map.visible(), ['radarlayer_2']);
    tick(168); assert.deepEqual(map.visible(), ['radarlayer_3']);
    tick(1000); assert.deepEqual(map.visible(), ['radarlayer_3']);
    tick(1168); assert.deepEqual(map.visible(), ['radarlayer_1']);
    hide(true); tick(10000); assert.deepEqual(map.visible(), ['radarlayer_1']);
    hide(false); tick(20000); assert.deepEqual(map.visible(), ['radarlayer_2']);
    tick(20001); assert.deepEqual(map.visible(), ['radarlayer_2']);
    assert.equal(frames.size, 1);
});

test('repeat starts, slide exits, and regional/local switching cancel every previous animation callback', async t => {
    const { w, tick, frames } = setup(t);
    const regional = await populated(w), local = await populated(w);
    regional.markReady(1, 2, 3); local.markReady(1, 2, 3);
    w.animateRadar(regional, [1, 2, 3]); tick(0);
    const obsolete = [...frames.values()][0];
    w.animateRadar(regional, [1, 2, 3]);
    assert.equal(frames.size, 1);
    w.animateRadar(local, [1, 2, 3]);
    obsolete(10000);
    assert.equal(frames.size, 1, 'late cancelled callbacks cannot restart playback');
    const paints = regional.paints.length;
    tick(100); tick(200);
    assert.equal(regional.paints.length, paints);
    w.stopRadar(regional);
    assert.equal(frames.size, 1, 'an obsolete slide exit cannot stop the new map');
    w.stopRadar(local);
    assert.equal(frames.size, 0);
    assert.deepEqual(local.visible(), ['radarlayer_2'], 'stop keeps the cached image');
    for (const call of ['stopRadar(regradar);', 'stopRadar(locradar);']) assert.ok(read('webroot/js/slides.js').includes(call));
});

test('initialization waits for style readiness, deduplicates concurrent starts, and survives provider errors', async t => {
    const { w, timers } = setup(t);
    const map = new FakeMap();
    w.regradar = map;
    map.styleReady = false;
    let requests = 0;
    const fetch = w.fetch;
    w.fetch = (...args) => { requests++; return fetch(...args); };
    const first = w.initializeRadar(map), second = w.initializeRadar(map);
    assert.equal(requests, 0);
    map.styleReady = true; map.emit('style.load');
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    assert.deepEqual(Array.from(w.regtimestamps), [1, 2, 3]);
    assert.equal(map.sources.size, 3);
    assert.equal(timers.size, 0, 'style/network deadlines are released');
    w.fetch = async () => ({ ok: false });
    await w.initializeRadar(map);
    assert.deepEqual(Array.from(w.regtimestamps), [1, 2, 3]);
    assert.equal(map.sources.size, 3);
});

test('late preload completion cannot restart a stopped slide or alter panel visibility', async t => {
    const { w, frames } = setup(t);
    const map = new FakeMap(); w.regradar = map;
    let resolveFetch;
    w.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
    const original = w.document.querySelector('.radar').getAttribute('style');
    w.startRadar(map);
    await Promise.resolve();
    w.stopRadar(map);
    resolveFetch({ ok: true, json: async () => ({ seriesInfo: { twcRadarMosaic: { series: [{ ts: 1 }] } } }) });
    await w.initializeRadar(map);
    assert.equal(frames.size, 0);
    assert.equal(w.document.querySelector('.radar').getAttribute('style'), original);
    assert.deepEqual(map.visible(), []);
});

test('style timeout/removal releases listeners and old-layer cleanup keeps the on-air frame', async t => {
    const { w, timers, tick } = setup(t);
    const slow = new FakeMap(); slow.styleReady = false;
    const pending = w.waitForRadarStyle(slow);
    [...timers.values()][0].callback();
    assert.equal(await pending, false);
    assert.equal(slow.listenerCount('style.load'), 0);
    assert.equal(slow.listenerCount('remove'), 0);
    const removed = w.waitForRadarStyle(slow);
    slow.emit('remove'); assert.equal(await removed, false);
    assert.equal(timers.size, 0);
    const map = await populated(w); map.markReady(1);
    w.animateRadar(map, [1, 2, 3]); tick(0);
    w.cleanupOldRadarLayers(map, [3]);
    assert.ok(map.getLayer('radarlayer_1'));
    assert.ok(map.getLayer('radarlayer_3'));
    assert.equal(map.getSource('radar_2'), undefined);
});

test('removed maps cancel playback and ignore late timestamp replies', async t => {
    const { w, frames } = setup(t);
    const map = await populated(w); map.markReady(1, 2, 3);
    w.animateRadar(map, [1, 2, 3]);
    let reply;
    w.fetch = () => new Promise(resolve => { reply = resolve; });
    const pending = w.initializeRadar(map);
    await Promise.resolve();
    map.emit('remove');
    assert.equal(frames.size, 0);
    reply({ ok: true, json: async () => ({ seriesInfo: { twcRadarMosaic: { series: [{ ts: 4 }] } } }) });
    await pending;
    assert.equal(map.getSource('radar_4'), undefined, 'late loads must not mutate a destroyed map');
});

test('retro history marker follows painted frame timestamps through -3, -2, -1, 0 and loop reset', async t => {
    const { w, tick, frames, timers } = setup(t);
    const map = new FakeMap(), timestamps = [1000, 4600, 8200, 11800];
    await w.addRadarLayers(map, timestamps); map.markReady(...timestamps);
    w.setRadarTimelineMap(map);
    const timeline = w.document.querySelector('.radar-timeline');
    const marker = timeline.querySelector('.radar-time-marker');
    assert.equal(marker.hidden, true, 'no invented playback position before a frame exists');
    w.animateRadar(map, timestamps);
    const samples = [[0, 0, 10800], [84, 1/3, 7200], [168, 2/3, 3600], [252, 1, 0]];
    for (const [time, progress, age] of samples) {
        tick(time); map.emit('render');
        assert.equal(marker.hidden, false);
        assert.ok(Math.abs(Number(timeline.style.getPropertyValue('--radar-progress')) - progress) < 1e-8);
        assert.equal(Number(timeline.dataset.ageSeconds), age);
        assert.equal(Number(timeline.dataset.frame), timestamps[samples.findIndex(sample => sample[0] === time)]);
    }
    tick(900); map.emit('render');
    assert.equal(timeline.style.getPropertyValue('--radar-progress'), '1', 'final hold retains latest position');
    tick(1252); map.emit('render');
    assert.equal(timeline.style.getPropertyValue('--radar-progress'), '0', 'wrap resets immediately, without a backward sweep');
    w.stopRadar(map); tick(10000);
    assert.equal(timeline.style.getPropertyValue('--radar-progress'), '0');
    assert.equal(frames.size, 0);
    assert.equal(timers.size, 0, 'indicator adds no independent animation timers');
});

test('history marker respects missing/partial data and freezes on the last good frame', async t => {
    const { w, tick } = setup(t);
    const map = new FakeMap(), timestamps = [1000, 4600, 8200, 11800];
    await w.addRadarLayers(map, timestamps); map.markReady(1000, 8200, 11800);
    w.setRadarTimelineMap(map); w.animateRadar(map, timestamps);
    const timeline = w.document.querySelector('.radar-timeline');
    tick(0); map.emit('render'); tick(84); map.emit('render');
    assert.equal(timeline.dataset.ageSeconds, '3600', 'missing -2h frame does not stretch the scale');
    map.ready.clear(); tick(168); map.emit('render');
    assert.equal(timeline.dataset.ageSeconds, '3600', 'buffering holds the shown frame and indicator');
    assert.ok(Math.abs(w.radarHistoryPosition([8200,11800],8200).progress - 2/3) < 1e-8);
    assert.equal(w.radarHistoryPosition([11800],11800).progress, 1);
    assert.equal(w.radarHistoryPosition([],null), null);
    assert.equal(w.radarHistoryPosition([11800],null), null);
});

test('shared history strip stays with the on-air radar until the map handoff', async t => {
    const { w, tick } = setup(t);
    const regional = new FakeMap(), local = new FakeMap();
    const ts = [1000, 4600, 8200, 11800];
    for (const map of [regional, local]) { await w.addRadarLayers(map, ts); map.markReady(...ts); }
    w.setRadarTimelineMap(regional); w.animateRadar(regional,ts);
    for (const time of [0,84,168,252]) { tick(time); regional.emit('render'); }
    const timeline = w.document.querySelector('.radar-timeline');
    assert.equal(timeline.dataset.ageSeconds,'0');
    w.animateRadar(local,ts); tick(300); local.emit('render');
    assert.equal(timeline.dataset.ageSeconds,'0','incoming offscreen view cannot move the outgoing indicator');
    w.setRadarTimelineMap(local);
    assert.equal(timeline.dataset.ageSeconds,'10800');
    regional.emit('render');
    assert.equal(timeline.dataset.ageSeconds,'10800');
    local.emit('remove');
    assert.equal(timeline.querySelector('.radar-time-marker').hidden,true);
});

test('history strip and Past 3 Hours caption appear only in 2005–06 without altering later legends', async t => {
    const { w } = setup(t);
    const style = w.document.createElement('style');
    style.textContent = read('webroot/css/intellistar-32-2007.css') + '\n' + read('webroot/css/radar-timeline.css');
    w.document.head.append(style);
    const display = selector => w.getComputedStyle(w.document.querySelector(selector)).display;
    for (const theme of ['2007','2008','2009','2010','2005-2006','2007']) {
        w.document.documentElement.dataset.theme = theme;
        const retro = theme === '2005-2006';
        assert.equal(display('.radar-timeline'), retro ? 'block' : 'none');
        assert.equal(display('.radar-history-strip'), retro ? 'block' : 'none');
        assert.equal(display('.radar-period-retro'), retro ? 'inline' : 'none');
        assert.equal(display('.radar-period-default') === 'none', retro);
        if (!retro) assert.equal(w.getComputedStyle(w.document.querySelector('.radar .key')).color,'rgb(48, 73, 118)');
    }
    assert.deepEqual(Array.from(w.document.querySelectorAll('.radar-hour'), el => el.textContent), ['-3','-2','-1','0']);
    assert.match(read('webroot/index.html'), /css\/radar-timeline\.css\?v=retro-history-2/);
});

test('monochrome radar banner replaces the blue bitmap only in retro and leaves other titles alone', t => {
    const { w } = setup(t);
    const style = w.document.createElement('style');
    style.textContent = ['webroot/main.css', 'webroot/css/intellistar-32-2007.css',
        'webroot/css/intellistar-32-2005-2006.css', 'webroot/css/radar-timeline.css']
        .map(file => read(file).replace(/@import[^;]+;/g, '')).join('\n');
    w.document.head.append(style);
    const css = selector => w.getComputedStyle(w.document.querySelector(selector));
    w.document.documentElement.dataset.theme = '2005-2006';
    assert.equal(css('.radar .header').fontSize, '0px', 'legacy title is replaced by the themed split lettering');
    assert.ok(['', 'none'].includes(css('.radar .header').backgroundImage), 'no inherited blue title background');
    assert.match(css('.radar .banner').backgroundImage, /linear-gradient/);
    assert.doesNotMatch(css('.radar .banner').backgroundImage, /radar_banner/);
    assert.equal(css('.radar-history-strip').height, '48px');
    assert.equal(css('.current-conditions .header').fontSize, '72px', 'approved non-radar title geometry is untouched');
    assert.match(css('.current-conditions .header').backgroundImage, /linear-gradient/);
    w.document.querySelector('.radar').dataset.radarRegion = 'local';
    assert.equal(css('.radar').getPropertyValue('--radar-lead-width').trim(), '230px');
    for (const theme of ['2007', '2008', '2009', '2010']) {
        w.document.documentElement.dataset.theme = theme;
        assert.notEqual(css('.radar .header').fontSize, '0px');
        assert.match(css('.radar .banner').backgroundImage, /radar_banner\.png/);
    }
});
