const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');

function setup(t, { legacyHTML = false } = {}) {
    const html = fs.readFileSync(path.join(root, 'webroot/index.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
    t.after(() => dom.window.close());
    const { window } = dom;
    if (legacyHTML) window.document.querySelector('meta[name="asset-revision"]').remove();
    const context = dom.getInternalVMContext();
    const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    load('node_modules/jquery/dist/jquery.js');
    load('node_modules/jquery.marquee/jquery.marquee.js');
    load('webroot/js/config.js');
    load('webroot/js/themes.js');
    load('webroot/js/extras.js');
    window.$.fx.off = true;
    window.inSettings = true;
    window.$.getJSON = () => { throw new Error('Theme changes must not request weather'); };
    const images = [];
    window.Image = class {
        set src(path) { this.path = path; images.push(this); }
    };
    async function select(version, error = false) {
        const promise = window.versionsChanger(version);
        const sheet = window.document.querySelector('link[media="not all"]');
        if (sheet) sheet[error ? 'onerror' : 'onload']();
        return promise;
    }
    return { window, context, load, images, select };
}

test('all versions, numeric strings, and retro alias select exactly one stylesheet', async t => {
    const { window: w, select } = setup(t);
    for (const version of [2007, '2008', 2009, 2010, '2005-2006', '2005', 2007]) {
        assert.equal(await select(version), true);
        const numeric = version === '2005-2006' ? 2005 : Number(version);
        assert.equal(w.appearanceSettings.graphicsPackage, numeric);
        assert.equal(w.appearanceSettings.iconSet, numeric === 2005 ? '2005-2006' : numeric === 2010 ? '2010' : '2007');
        assert.equal(w.document.querySelectorAll('#theme-styles').length, 1);
        assert.equal(w.document.querySelectorAll('.versionsbutton[aria-pressed="true"]').length, 1);
        assert.equal(w.document.querySelector(`#versions${numeric}`).getAttribute('aria-pressed'), 'true');
    }
    assert.equal(await select('invalid'), false);
    assert.equal(w.appearanceSettings.graphicsPackage, 2007);
});

test('rapid switching and failed stylesheet loads retain the last successful state', async t => {
    const { window: w, select } = setup(t);
    await select(2007);
    const retro = w.versionsChanger(2005);
    const retroSheet = w.document.querySelector('link[media="not all"]');
    const modern = w.versionsChanger(2010);
    const modernSheet = [...w.document.querySelectorAll('link[media="not all"]')].at(-1);
    modernSheet.onload();
    retroSheet.onload();
    assert.equal(await modern, true);
    assert.equal(await retro, false);
    assert.equal(w.appearanceSettings.graphicsPackage, 2010);
    assert.equal(await select(2005, true), false);
    assert.equal(w.appearanceSettings.graphicsPackage, 2010);
    assert.equal(w.document.documentElement.dataset.theme, '2010');
    assert.equal(w.document.querySelectorAll('link[media="not all"]').length, 0);

    const pending = w.versionsChanger(2005);
    const pendingSheet = w.document.querySelector('link[media="not all"]');
    await w.versionsChanger(2010); // reselecting the active theme cancels a pending change
    pendingSheet.onload();
    assert.equal(await pending, false);
    assert.equal(w.appearanceSettings.graphicsPackage, 2010);
});

test('icons fall back, use dedicated retro PNGs, and ignore obsolete asynchronous loads', async t => {
    const { window: w, select, images } = setup(t);
    await select(2005);
    const icon = w.document.createElement('div');
    w.document.body.appendChild(icon);
    w.getIcon(w.$(icon), 400, 'current', 'large');
    assert.match(icon.style.backgroundImage, /2007\/large\/Ts.webp/);
    const retroTs = images.find(image => image.path.endsWith('/large/Ts.png'));
    assert.ok(retroTs);
    retroTs.onload();
    await Promise.resolve();
    assert.match(icon.style.backgroundImage, /2005-2006\/large\/Ts.png/);

    w.getIcon(w.$(icon), 400, 'ldl');
    const still = images.find(image => image.path.endsWith('/stills/Ts.png'));
    still.onerror();
    await Promise.resolve();
    assert.match(icon.style.backgroundImage, /2007\/stills\/Ts.mv.png/);
    const count = images.length;
    w.getIcon(w.$(icon), 400, 'ldl');
    assert.equal(images.length, count, 'missing assets are checked only once per page');

    w.getIcon(w.$(icon), 400, 'current', 'map');
    const map = images.find(image => image.path.endsWith('/map/Ts.png'));
    await select(2010);
    map.onload();
    await Promise.resolve();
    assert.match(icon.style.backgroundImage, /2010\/large\/Ts.webp/);

    await select(2005);
    w.getIcon(w.$(icon), 'unknown-code', 'forecast', 'large');
    await Promise.resolve();
    assert.match(icon.style.backgroundImage, /blank.apng/);
    w.getIcon(w.$(icon), null, 'current');
    assert.match(icon.style.backgroundImage, /blank.apng/);
});

test('retro frame fits portrait, 4:3, and wide viewports and resets to 3:2', async t => {
    const { window: w, select, load } = setup(t);
    w.$('#main').css({ width: 1620, height: 1080 });
    load('webroot/js/main.js');
    await new Promise(resolve => w.$(resolve));
    for (const version of [2005, 2010, 2005, 2008]) {
        await select(version);
        for (const [width, height] of [[480, 360], [1920, 1080], [390, 844], [1440, 1000]]) {
            w.innerWidth = width;
            w.innerHeight = height;
            w.dispatchEvent(new w.Event('resize'));
            const transform = w.document.getElementById('main').style.transform;
            const [, x, y] = transform.match(/scale\(([^,]+), ([^)]+)\)/);
            const boxWidth = 1620 * Number(x), boxHeight = 1080 * Number(y);
            assert.ok(boxWidth <= width + 0.01 && boxHeight <= height + 0.01);
            assert.ok(Math.abs(boxWidth / boxHeight - (version === 2005 ? 4 / 3 : 3 / 2)) < 0.001);
            assert.equal(w.document.getElementById('settings-menu').style.transform, transform);
        }
    }
});

test('LDL theme transitions own their timers, preserve alerts, and never touch weather loops', async t => {
    const { window: w, context, load, select } = setup(t);
    load('webroot/js/weather.js');
    load('webroot/js/ldl.js');
    w.locationConfig = { mainCity: { displayname: 'Corvallis' } };
    w.appearanceSettings.ldlType = 'observations';
    w.appearanceSettings.marqueeAd = ['Mixed-case crawl with NW winds.'];
    w.appearanceSettings.startupTime = 0;
    await select(2010);
    w.inSettings = false;
    w.startLoops();
    assert.ok(vm.runInContext('ldlTimers.size', context) > 0);
    await select(2005);
    assert.equal(w.$('.ldl-blue').css('display'), 'none');
    assert.notEqual(w.$('.ldl-black').css('display'), 'none');
    assert.equal(vm.runInContext('ldlTimers.size', context), 2);
    await select(2010);
    await select(2005);
    assert.equal(vm.runInContext('ldlTimers.size', context), 2, 'no duplicate black LDL timers');

    w.weatherInfo.bulletin.crawlAlert.alert = { name: 'Special Weather Statement', description: 'Partly cloudy. Winds NW at 15 mph.' };
    w.startAlertCrawl();
    const text = w.$('.alertcrawl').text();
    assert.match(text, /Partly cloudy\. Winds NW at 15 mph\./);
    assert.equal(vm.runInContext('ldlTimers.size', context), 0);
    await select(2010);
    assert.equal(w.alertActive, true);
    assert.equal(w.$('.alertcrawl').text(), text);
    assert.equal(vm.runInContext('ldlTimers.size', context), 0);
    w.endAlertCrawl();
    assert.equal(w.alertActive, false);
    assert.ok(vm.runInContext('ldlTimers.size', context) > 0);
    w.stopLDLLoops();
    assert.equal(vm.runInContext('ldlTimers.size', context), 0);
});

test('existing forecast renderers continue with unchanged data and slide scheduling across themes', async t => {
    const { window: w, load, select } = setup(t);
    load('webroot/js/weather.js');
    load('webroot/js/slides.js');
    w.locationConfig = { mainCity: { extraname: 'Corvallis' } };
    w.audioPlayer = { playEF() {}, playLF() {} };
    w.audioSettings.vocallocal = false;
    w.slideLength = 8000;
    w.slideFlavor = { order: [{ slides: 1 }] };
    w.weatherInfo.dayDesc.days = [{
        name: 'Today', desc: 'Partly cloudy. Winds NW at 15 mph.',
        cond: { name: 'partly_cloudy', time: '' }
    }];
    w.weatherInfo.weekAhead.days = ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'MON'].map(name => ({
        name, cond: 'Scattered Thunderstorms', high: 69, low: 47, icon: 400
    }));
    const before = JSON.stringify(w.weatherInfo);
    const scheduled = [];
    const cancelled = [];
    w.setTimeout = (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; };
    w.clearTimeout = timer => cancelled.push(timer);
    await select(2010);
    w.slidePrograms.localForecast(0);
    assert.equal(w.$('.local-forecast .description').text(), w.weatherInfo.dayDesc.days[0].desc);
    w.slidePrograms.weekAhead();
    assert.equal(w.$('.week-ahead .day.i .cond').text(), 'Scattered Thunderstorms');
    const slideTimers = scheduled.filter(timer => timer.delay === 7667);
    assert.equal(slideTimers.length, 2);
    for (const version of [2005, 2007, 2008, 2009, 2010]) {
        await select(version);
        assert.equal(JSON.stringify(w.weatherInfo), before);
        assert.equal(w.$('.local-forecast .description').text(), 'Partly cloudy. Winds NW at 15 mph.');
        assert.match(w.$('.week-ahead .day.i .icon')[0].style.backgroundImage,
            version === 2010 ? /2010\/large\/Ts.webp/ : /2007\/large\/Ts.webp/);
    }
    assert.equal(cancelled.length, 0, 'theme switching leaves slide timers intact');
    assert.equal(scheduled.filter(timer => timer.delay === 7667).length, 2, 'no slide restart');
    let advanced = 0;
    w.slideCallBack = () => advanced++;
    slideTimers[0].callback();
    scheduled.at(-1).callback();
    assert.equal(advanced, 1, 'already-scheduled slide transition still completes');
});

test('textured retro presentation and split titles do not leak into later packages', async t => {
    const { window: w, select } = setup(t);
    const defaults = w.document.createElement('style');
    defaults.textContent = fs.readFileSync(path.join(root, 'webroot/main.css'), 'utf8');
    w.document.head.appendChild(defaults);
    const retro = w.document.createElement('style');
    retro.textContent = fs.readFileSync(path.join(root, 'webroot/css/intellistar-32-2005-2006.css'), 'utf8')
        .replace(/@import[^;]+;/, '');
    w.document.head.appendChild(retro);
    assert.ok(fs.statSync(path.join(root, 'webroot/images/themes/2005-2006/sky.jpg')).size > 0);
    assert.match(retro.textContent, /images\/themes\/2005-2006\/sky\.jpg/);
    const header = w.document.querySelector('.current-conditions .header');
    assert.equal(header.querySelector('.theme-title-default').textContent, 'Now');
    assert.equal(header.querySelector('.title-lead').textContent, 'current');
    assert.equal(header.querySelector('.title-tail').textContent, 'conditions');
    for (const version of [2005, 2007, 2008, 2009, 2010, 2005]) {
        await select(version);
        const isRetro = version === 2005;
        assert.equal(w.getComputedStyle(header.querySelector('.theme-title-default')).display === 'none', isRetro);
        assert.equal(w.getComputedStyle(header.querySelector('.theme-title-retro')).display, isRetro ? 'inline-flex' : 'none');
        assert.equal(w.getComputedStyle(w.document.querySelector('#settings-menu .bg')).visibility,
            isRetro ? 'hidden' : 'visible');
        // Map titles are still dynamic text, untouched by the split-title markup.
        assert.equal(w.document.querySelector('.map .theme-title-retro'), null);
    }
});

test('theme requests bypass old URLs and title visibility is explicit without loaded CSS', async t => {
    const { window: w, select } = setup(t);
    const revision = w.document.querySelector('meta[name="asset-revision"]').content;
    for (const version of [2005, 2010, 2007, 2005]) {
        await select(version);
        const stylesheet = new URL(w.document.querySelector('#theme-styles').href);
        assert.equal(stylesheet.searchParams.get('v'), revision);
        for (const title of w.document.querySelectorAll('.theme-title-retro')) {
            assert.equal(title.hidden, version !== 2005);
            assert.match(title.textContent, /\S \S/);
        }
        for (const title of w.document.querySelectorAll('.theme-title-default')) {
            assert.equal(title.hidden, version === 2005);
        }
    }
});


test('new theme code still initializes if an older entry page lacks revision metadata', async t => {
    const { window: w, select } = setup(t, { legacyHTML: true });
    assert.equal(await select(2005), true);
    assert.match(w.document.querySelector('#theme-styles').href, /\?v=mapbox-runtime-20261013-4$/);
});

test('retro almanac and air-quality text stays legible without changing category colors or later eras', async t => {
    const { window: w, select } = setup(t);
    for (const file of ['webroot/main.css', 'webroot/css/intellistar-32-2007.css', 'webroot/css/intellistar-32-2005-2006.css']) {
        const style = w.document.createElement('style');
        style.textContent = fs.readFileSync(path.join(root, file), 'utf8').replace(/@import[^;]+;/, '');
        w.document.head.appendChild(style);
    }
    w.$('.almanac .day.i .sunrise').html('7:25 <span>am</span>');
    w.$('.air-quality .pollutants').html('<span>None</span>');
    w.$('.week-ahead .day.i .name').addClass('wk');
    const labels = [
        '.almanac .almheader', '.almanac .sunrise', '.almanac .sunrise span',
        '.almanac .sunset', '.almanac .sunrise-text', '.almanac .sunset-text',
        '.almanac .stationname', '.almanac .almdate', '.almanac .bottomheader .high',
        '.almanac .y-header', '.almanac .a-header', '.almanac .r-header',
        '.almanac .yesterday .high', '.almanac .average .low',
        '.almanac .records .highyear', '.almanac .records .lowyear',
        '.air-quality .day', '.air-quality .header-text', '.air-quality .pollutants span',
        '.air-quality .source', '.air-quality .qualitybar .low .text',
        '.eight-cities .top .wind'
    ];
    const styleOf = selector => w.getComputedStyle(w.document.querySelector(selector));
    const categories = ['extreme', 'high', 'unhealthy', 'moderate', 'low'];
    const bandColors = categories.map(category => styleOf(`.qualitybar .${category}`).backgroundColor);
    for (const version of [2005, 2007, 2005]) {
        await select(version);
        if (version === 2005) {
            assert.equal(w.getComputedStyle(w.document.documentElement).getPropertyValue('--retro-ink').trim(), '#f3f5ee');
            for (const selector of labels) {
                // jsdom preserves custom-property references; Chromium checks resolve them.
                assert.match(styleOf(selector).color, /^(var\(--retro-ink\)|rgb\(243, 245, 238\))$/, selector);
                assert.match(styleOf(selector).textShadow, /retro-text-shadow|rgba/, selector);
            }
            for (const category of ['moderate', 'unhealthy']) {
                assert.equal(styleOf(`.qualitybar .${category} .text`).color, 'rgb(16, 33, 60)');
            }
            assert.match(styleOf('.air-quality .qualityarrow').filter, /invert\(1\)/);
            assert.equal(styleOf('.air-quality .source').bottom, '244px');
            assert.equal(styleOf('.current-conditions .title-tail').color, 'rgb(23, 42, 50)');
            assert.equal(styleOf('.week-ahead .name.wk').color, 'rgb(48, 75, 97)');
            assert.equal(styleOf('.map .city .temp').color, 'rgb(226, 223, 101)');
        } else {
            for (const selector of ['.almanac .day', '.air-quality .day', '.air-quality .source']) {
                assert.equal(styleOf(selector).color, 'rgb(48, 73, 118)');
            }
            assert.equal(styleOf('.air-quality .source').bottom, '212px');
            assert.ok(!styleOf('.air-quality .qualityarrow').filter.includes('invert'));
        }
        assert.deepEqual(categories.map(category => styleOf(`.qualitybar .${category}`).backgroundColor), bandColors);
    }
});

test('current-conditions glass treatment is feathered and isolated from radar, other products and later packages', async t => {
    const { window: w, select } = setup(t);
    for (const file of ['webroot/main.css', 'webroot/css/intellistar-32-2007.css', 'webroot/css/intellistar-32-2005-2006.css', 'webroot/css/radar-timeline.css']) {
        const style = w.document.createElement('style');
        style.textContent = fs.readFileSync(path.join(root, file), 'utf8').replace(/@import[^;]+;/, '');
        w.document.head.append(style);
    }
    await select(2005);
    const snapshot = selector => {
        const s = w.getComputedStyle(w.document.querySelector(selector));
        return [s.backgroundImage, s.fontSize, s.fontFamily, s.color, s.borderBottomWidth, s.height, s.width];
    };
    const untouched = ['.radar .header', '.radar .banner', '.local-forecast .header', '.current-conditions .box', '#background'];
    const before = untouched.map(snapshot);
    const style = w.document.createElement('style');
    style.textContent = fs.readFileSync(path.join(root, 'webroot/css/current-conditions-banner.css'), 'utf8');
    w.document.head.append(style);
    assert.deepEqual(untouched.map(snapshot), before);
    const css = selector => w.getComputedStyle(w.document.querySelector(selector));
    assert.ok(['', 'none'].includes(css('.current-conditions .header').backgroundImage));
    assert.equal(css('.current-conditions .header').borderBottomWidth, '0px');
    assert.ok(['', 'none'].includes(css('.current-conditions .title-lead').backgroundImage));
    assert.match(css('.current-conditions .title-lead').fontFamily, /Interstate Bold Italic/);
    for (const rule of style.sheet.cssRules) {
        assert.match(rule.selectorText, /^html\[data-theme="2005-2006"\] #main /);
        assert.match(rule.selectorText, /\.current-conditions/);
    }
    const tail = [...style.sheet.cssRules].find(rule => rule.selectorText.endsWith('.title-tail::before'));
    assert.match(tail.style.background, /linear-gradient.*transparent/);
    assert.match(tail.style.getPropertyValue('mask-image'), /transparent 92%/);
    assert.equal(tail.style.bottom, '-18px', 'the light wash feathers below the lettering rather than ending in a sharp box');
    assert.equal(w.document.querySelectorAll('link[href^="css/current-conditions-banner.css"]').length, 1);
    for (const version of [2007,2008,2009,2010]) {
        await select(version);
        const current = snapshot('.current-conditions .header');
        style.remove();
        assert.deepEqual(snapshot('.current-conditions .header'), current);
        w.document.head.append(style);
    }
});
