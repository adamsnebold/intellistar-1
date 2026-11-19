const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { execFileSync } = require('node:child_process');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function setup(t) {
    const dom = new JSDOM(read('webroot/index.html'), { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const w = dom.window, context = dom.getInternalVMContext();
    const load = file => vm.runInContext(read(file), context);
    load('node_modules/jquery/dist/jquery.js');
    load('webroot/js/config.js'); load('webroot/js/weather.js'); load('webroot/js/slides.js');
    w.$.fx.off = true;
    let now = 0, id = 0;
    const timers = new Map();
    w.setTimeout = (callback, delay) => { timers.set(++id, { callback, due: now + (Number(delay) || 0) }); return id; };
    w.clearTimeout = id => timers.delete(id);
    return { w, load, timers, advance(ms) {
        const until = now + ms;
        while (true) {
            const entry = [...timers].filter(([,timer]) => timer.due <= until).sort((a,b) => a[1].due - b[1].due)[0];
            if (!entry) break;
            timers.delete(entry[0]); now = entry[1].due; entry[1].callback();
        }
        now = until;
    } };
}

test('solar wall-clock times do not change with the viewer zone, including DST and fractional offsets', () => {
    const cases = [
        ['2026-07-14T05:37:00-0400', '5:37 am'],
        ['2026-11-01T06:27:00-05:00', '6:27 am'],
        ['2026-07-14T20:31:00+0100', '8:31 pm'],
        ['2026-10-14T06:02:00+0545', '6:02 am'],
        ['2026-10-14T18:32:00+1030', '6:32 pm'],
        ['2026-10-14T00:05:00Z', '12:05 am'],
        ['2026-10-14T12:00:00+1400', '12:00 pm'],
        [null, '—'], [undefined, '—'], ['invalid', '—'], ['2026-10-14T25:62:00Z', '—']
    ];
    for (const zone of ['America/Los_Angeles', 'UTC', 'Asia/Tokyo']) {
        const script = `const vm=require('node:vm'),fs=require('node:fs');const c=vm.createContext({});vm.runInContext(fs.readFileSync('webroot/js/weather.js','utf8'),c);console.log(JSON.stringify(${JSON.stringify(cases.map(([input])=>input))}.map(input=>c.formatSolarTime(input))));`;
        const result = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
        assert.deepEqual(result, cases.map(([,expected])=>expected), zone);
    }
});

test('daily forecast ingestion and repeat almanac rendering preserve the selected location date/time', async t => {
    const { w } = setup(t);
    w.locationConfig = { mainCity: { lat: 40.7, lon: -74 } };
    w.codetoFcst = { 100: { mov: 'clear' } };
    const data = {
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        validTimeLocal: ['2026-11-01T07:00:00-0500', '2026-11-02T07:00:00-0500'],
        sunriseTimeLocal: ['2026-11-01T06:27:00-0500', '2026-11-02T06:28:00-0500'],
        sunsetTimeLocal: ['2026-11-01T16:50:00-0500', null],
        daypart: [{ daypartName: Array(16).fill('Sunday'), narrative: Array(16).fill('Clear.'),
            qualifierCode: Array(16).fill(null), iconCodeExtend: Array(16).fill(100),
            wxPhraseLong: Array(16).fill('Clear'), temperature: Array(16).fill(60) }]
    };
    w.$.getJSON = (url, callback) => { callback(data); return { fail() {} }; };
    await w.grabLocalForecast();
    assert.equal(w.weatherInfo.almanac.days[0].sunrise, '6:27 am');
    assert.equal(w.weatherInfo.almanac.days[0].sunset, '4:50 pm');
    assert.equal(w.weatherInfo.almanac.days[1].sunset, '—');
    assert.equal(w.weatherInfo.almanac.dateLabel, 'NOVEMBER 1');
    assert.equal(w.solarDateLabel('2026-01-01T00:01:00+1400'), 'JANUARY 1');
    w.slideLength = 8000;
    w.slidePrograms.almanac(); w.slidePrograms.almanac();
    assert.equal(w.$('.almanac .day.i .sunrise').text(), '6:27 am', 'repeat visits replace, not append');
    assert.equal(w.$('.almanac .almdate').text(), 'NOVEMBER 1');
});

function radarFixture(w) {
    const started = [], stopped = [];
    for (const name of ['regradar','regmap','regoutlines','regoutlinestrans','locradar','locmap','locoutlines','locoutlinestrans']) w[name] = Object.assign(new EventEmitter(), { name, resize() {}, frameReady: true });
    w.radarState = () => ({ current: 1 });
    w.radarFrameReady = map => map.frameReady;
    w.startRadar = map => started.push(map.name);
    w.stopRadar = map => stopped.push(map?.name || 'all');
    w.mapStyle = 'mapbox://styles/colster/cmiccqynn00as01s4bt6501il';
    w.addRadarCities = () => {};
    w.audioPlayer = { playRadar() {}, stopPlaying() {} };
    return { started, stopped };
}

test('radar handoff keeps the shared panel, honors deadlines and ignores stale slide callbacks', t => {
    const { w, timers, advance } = setup(t);
    const { started, stopped } = radarFixture(w);
    let completed = 0;
    w.slidePrograms.done = () => completed++;
    w.slideFlavor.order = [{ function: 'radarDoppler', slideDelay: 8000 }, { function: 'localDoppler', slideDelay: 8000 }, { function: 'done', slideDelay: 1000 }];
    w.slideKickOff();
    const obsolete = [...timers.values()].find(timer => timer.due === 8000).callback;
    advance(7999); assert.deepEqual(started, ['regradar']);
    advance(1); assert.deepEqual(started, ['regradar', 'locradar']);
    assert.equal(w.$('.radar').css('display'), 'block');
    assert.equal(w.$('.local-radar-group').css('display'), 'block');
    assert.ok(stopped.includes('regradar'));
    obsolete(); assert.equal(w.idx, 1);
    advance(8000); assert.equal(completed, 1);
    assert.ok(stopped.includes('locradar'));
    assert.equal(w.$('.radar').css('display'), 'none');
    assert.equal(w.eval('slideTimers.size'), 0, 'no slide-owned callbacks remain (jQuery may have its own tick)');
});

test('custom radar durations are honored and foreign basemap outlines remain hidden', t => {
    const { w, advance } = setup(t); radarFixture(w);
    w.mapStyle = 'mapbox://styles/foreign/map';
    let done = false;
    w.slidePrograms.done = () => { done = true; };
    w.slideFlavor.order = [{ function: 'localDoppler', slideDelay: 4500 }, { function: 'done', slideDelay: 1000 }];
    w.slideKickOff();
    assert.equal(w.$('#locoutlinestrans').css('display'), 'none');
    assert.equal(w.$('#locradar').css('display'), 'block');
    advance(4499); assert.equal(done, false);
    advance(1); assert.equal(done, true);
    assert.equal(w.slideSettings.order.find(slide => slide.function === 'localDoppler').slideDelay, 8000);
    assert.doesNotMatch(read('webroot/js/extras.js'), /function:"localDoppler",slideDelay:12000/);
});

test('restarting the sequence cancels old timers without touching independent weather timers', t => {
    const { w, advance } = setup(t); radarFixture(w);
    let weather = 0;
    w.setTimeout(() => weather++, 1000);
    w.slideFlavor.order = [{ function: 'radarDoppler', slideDelay: 8000 }, { function: 'localDoppler', slideDelay: 8000 }];
    w.slideKickOff(); advance(4000); w.slideKickOff(); advance(4000);
    assert.equal(w.idx, 0, 'previous run cannot advance this one at its old deadline');
    assert.equal(weather, 1);
    advance(4000); assert.equal(w.idx, 1);
});

test('map forecast periods include exit transitions in the configured duration', t => {
    const { w, advance } = setup(t);
    w.regionalMapLayer = { render() {} };
    w.locationConfig = { regionalMap: { map: [] } };
    w.weatherInfo.map.days = ['Tonight', 'Tomorrow'];
    let done = 0;
    w.slidePrograms.done = () => done++;
    w.slideFlavor.order = [{ function: 'mapForecast', slides: 2, slideDelay: 7000 }, { function: 'done', slideDelay: 1000 }];
    w.slideKickOff();
    advance(7000); assert.equal(w.$('.map .header').text(), "Tomorrow's Forecast");
    advance(6999); assert.equal(done, 0);
    advance(1); assert.equal(done, 1);
});

test('product switches are immediate and opaque, with no queued fade even when animations are enabled', t => {
    const { w } = setup(t);
    w.$.fx.off = false;
    w.$.fn.animate = () => { throw new Error('Whole-product fades are not allowed'); };
    w.$('.radar').css('opacity', 0.3);
    w.showSlide('.radar');
    assert.equal(w.$('.radar').css('opacity'), '1');
    w.hideSlide('.radar');
    w.showSlide('.almanac');
    assert.equal(w.$('.radar').css('display'), 'none');
    assert.equal(w.$('.almanac').css('opacity'), '1');
    assert.equal(w.$('.almanac').queue('fx').length, 0);
});

test('radar title and stack switch together only after an incoming complete frame is painted', t => {
    const { w, advance } = setup(t); radarFixture(w);
    w.slideFlavor.order = [{ function: 'radarDoppler', slideDelay: 8000 }, { function: 'localDoppler', slideDelay: 8000 }];
    w.slideKickOff(); advance(8000);
    assert.equal(w.$('.radar .header').text(), 'Regional Doppler');
    assert.equal(w.$('.regional-radar-group').css('display'), 'block');
    assert.equal(w.$('.local-radar-group').css('visibility'), 'hidden');
    w.locradar.frameReady = false;
    w.locradar.emit('render');
    assert.equal(w.$('.local-radar-group').css('visibility'), 'hidden');
    w.locradar.frameReady = true;
    w.locradar.emit('render');
    assert.equal(w.$('.regional-radar-group').css('display'), 'none');
    assert.equal(w.$('.local-radar-group').css('visibility'), 'visible');
    assert.equal(w.$('.local-radar-group').css('opacity'), '1');
    assert.equal(w.$('.radar .header').text(), 'Local Doppler');
    assert.equal(w.$('.radar').attr('data-radar-region'), 'local');
    assert.equal(w.$('.radar .header').attr('data-radar-region'), 'local');
    assert.equal(w.locradar.listenerCount('render'), 0);
});

test('a slow radar handoff is bounded and an interrupted handoff cannot reveal a stale view', t => {
    const { w, advance } = setup(t); radarFixture(w);
    w.slideFlavor.order = [{ function: 'radarDoppler', slideDelay: 8000 }, { function: 'localDoppler', slideDelay: 8000 }];
    w.slideKickOff(); advance(8000); advance(499);
    assert.equal(w.$('.radar .header').text(), 'Regional Doppler');
    advance(1);
    assert.equal(w.$('.radar .header').text(), 'Local Doppler');
    assert.equal(w.$('.radar').attr('data-radar-region'), 'local');
    assert.equal(w.$('.radar .header').attr('data-radar-region'), 'local');
    assert.equal(w.locradar.listenerCount('render'), 0);
    w.slideKickOff(); advance(8000);
    const obsolete = w.locradar.listeners('render')[0];
    w.slideKickOff();
    obsolete();
    assert.equal(w.$('.radar .header').text(), 'Regional Doppler');
    assert.equal(w.$('.local-radar-group').css('display'), 'none');
    assert.equal(w.locradar.listenerCount('render'), 0);
    assert.equal(w.eval('slideCleanups.size'), 0);
});

test('regional map title splits dynamic periods safely and restores Now without stale forecast text', t => {
    const { w } = setup(t);
    for (const period of ['Today', 'Tonight', 'Tomorrow', 'Wednesday', 'Wednesday Night', null]) {
        w.setMapHeader(period);
        const expected = period ? `${period}'s` : 'Regional';
        assert.equal(w.$('.map-title-lead').text(), expected);
        assert.equal(w.$('.map-title-tail').text(), 'Forecast');
        assert.equal(w.$('.map .header').text(), `${expected} Forecast`);
        assert.equal(w.$('.map .header').attr('data-map-title'), 'forecast');
    }
    w.setMapHeader('<b>Today</b>');
    assert.equal(w.$('.map .header b').length, 0, 'provider strings are text, not markup');
    w.setMapHeader(null, true);
    assert.equal(w.$('.map .header').text(), 'Now');
    assert.equal(w.$('.map-title-tail').text(), '');
    assert.equal(w.$('.map .header').attr('data-map-title'), 'current');
    assert.equal(w.$('.map-title-lead').length, 1, 'repeated visits replace the title');
});

test('monochrome forecast styling is confined to the retro map heading', t => {
    const { w } = setup(t);
    const base = w.document.createElement('style');
    base.textContent = ['webroot/main.css', 'webroot/css/intellistar-32-2007.css', 'webroot/css/intellistar-32-2005-2006.css',
        'webroot/css/radar-timeline.css', 'webroot/css/current-conditions-banner.css']
        .map(file=>read(file).replace(/@import[^;]+;/g,'')).join('\n');
    w.document.head.append(base);
    w.document.documentElement.dataset.theme = '2005-2006';
    w.setMapHeader('Tonight');
    const snapshot = selector => {
        const s=w.getComputedStyle(w.document.querySelector(selector));
        return [s.backgroundImage,s.fontSize,s.color,s.display,s.width,s.height];
    };
    const untouched = ['.radar .header','.radar .banner','.current-conditions .header','.local-forecast .header','.map-cities .temp','.map-regional'];
    const before=untouched.map(snapshot);
    const sheet=w.document.createElement('style');
    sheet.textContent=read('webroot/css/map-forecast-banner.css');
    w.document.head.append(sheet);
    assert.deepEqual(untouched.map(snapshot),before);
    assert.equal(w.getComputedStyle(w.document.querySelector('.map > .box')).display,'none');
    assert.equal(w.getComputedStyle(w.document.querySelector('.map-title-lead')).color,'rgb(242, 243, 233)');
    assert.equal(w.getComputedStyle(w.document.querySelector('.map-title-tail')).color,'rgb(16, 21, 14)');
    for (const rule of sheet.sheet.cssRules) {
        assert.match(rule.selectorText,/html\[data-theme="2005-2006"\]/);
        assert.match(rule.selectorText,/\.map(?:\s|\.)/);
    }
    for (const theme of ['2007','2008','2009','2010']) {
        w.document.documentElement.dataset.theme=theme;
        const expected=['.map .header','.map > .box','.map-title-lead','.map-title-tail'].map(snapshot);
        sheet.remove();
        assert.deepEqual(['.map .header','.map > .box','.map-title-lead','.map-title-tail'].map(snapshot),expected);
        w.document.head.append(sheet);
    }
});
