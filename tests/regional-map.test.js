const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function setup(t) {
    const dom = new JSDOM(read('webroot/index.html'), { runScripts: 'outside-only', url: 'http://localhost/' });
    t.after(() => dom.window.close());
    const w = dom.window, context = dom.getInternalVMContext();
    const load = file => vm.runInContext(read(file), context, { filename: file });
    load('node_modules/jquery/dist/jquery.js');
    load('webroot/js/config.js');
    load('webroot/js/extras.js');
    load('webroot/js/regional-map.js');
    // Load the location layout functions without the unrelated IP geolocation boot.
    vm.runInContext(read('webroot/js/newlocation.js').replace(/\ngrabLocation\(\)\.then\(\(\) =>\{[\s\S]*?\n\}\);/, ''), context);
    w.$.fx.off = true;
    w.map_key = 'pk.static-map-test';
    const images = [], timers = new Map();
    let timerID = 0;
    w.setTimeout = callback => { timers.set(++timerID, callback); return timerID; };
    w.clearTimeout = id => timers.delete(id);
    w.Image = function () {
        const image = w.document.createElement('img');
        images.push(image);
        return image;
    };
    const setCity = (city, nearby = []) => {
        w.locationConfig.mainCity = city;
        w.locationConfig.eightCities.cities = nearby;
    };
    return { w, load, images, timers, setCity, layer: w.regionalMapLayer };
}
const london = { displayname: 'London', lat: 51.5074, lon: -0.1278, country: 'United Kingdom' };
const londonRegion = [
    { displayname: 'Cambridge', lat: 52.2053, lon: 0.1218 },
    { displayname: 'Oxford', lat: 51.752, lon: -1.2577 },
    { displayname: 'Brighton', lat: 50.8225, lon: -0.1372 }
];

test('US atlas coverage handles country metadata, coordinates, territories, and invalid values', t => {
    const { layer } = setup(t);
    for (const city of [
        { lat: 44.56, lon: -123.26, country: 'United States' },
        { lat: 40.71, lon: -74.01, countryCode: 'US' }
    ]) assert.equal(layer.needsStatic(city), false);
    for (const city of [london,
        { lat: 49.28, lon: -123.12, country: 'Canada' },
        { lat: 32.5, lon: -117, countryCode: 'MX' },
        { lat: 61.2, lon: -149.9, country: 'United States' },
        { lat: 21.3, lon: -157.8, country: 'United States' },
        { lat: 35.68, lon: 139.69 }, { lat: 0, lon: 0 }, { lat: -33.86, lon: 151.2 }
    ]) assert.equal(layer.needsStatic(city), true, JSON.stringify(city));
    for (const city of [{}, { lat: '', lon: '' }, { lat: ' ', lon: 0 }, { lat: 91, lon: 0 }, { lat: 1, lon: NaN }]) {
        assert.equal(layer.needsStatic(city), false);
        assert.equal(layer.layout(city, []), null);
    }
});

test('static URL centers on real coordinates, separates required branding, and supplies retro borders and public token', t => {
    const { layer } = setup(t);
    const view = layer.layout(london, londonRegion);
    const url = new URL(layer.buildURL(view, 'pk.static-map-test'));
    assert.equal(url.hostname, 'api.mapbox.com');
    assert.match(url.pathname, new RegExp(`/static/-0.1278,51.5074,${view.zoom},0,0/1080x600@2x$`));
    assert.equal(url.searchParams.get('access_token'), 'pk.static-map-test');
    assert.equal(url.searchParams.get('logo'), 'false', 'wordmark is rendered separately from the graded image');
    assert.match(read('webroot/index.html'), /class="international-map-logo"/);
    const borders = JSON.parse(url.searchParams.get('addlayer'));
    assert.equal(borders['source-layer'], 'admin');
    assert.equal(borders.paint['line-color'], '#303e32');
});

test('atlas grade and official branding are valid separate assets scoped to international maps', t => {
    const { w } = setup(t);
    const parser = new w.DOMParser();
    const grade = parser.parseFromString(read('webroot/images/maps/international-atlas-filter.svg'), 'image/svg+xml');
    const logo = parser.parseFromString(read('webroot/images/maps/mapbox-logo.svg'), 'image/svg+xml');
    assert.equal(grade.querySelector('parsererror'), null);
    assert.equal(logo.querySelector('parsererror'), null);
    assert.equal(grade.querySelector('#atlas').getAttribute('color-interpolation-filters'), 'sRGB');
    assert.ok(grade.querySelector('[result="gradedWater"]'));
    assert.ok(grade.querySelector('[result="gradedLand"]'));
    assert.equal(logo.documentElement.getAttribute('viewBox'), '0 0 88 23');
    assert.ok(logo.querySelector('path'), 'complete official vector artwork is available');
    const style = w.document.createElement('style');
    style.textContent = read('webroot/css/regional-map.css');
    w.document.head.append(style);
    const rules = Array.from(style.sheet.cssRules);
    const imageRule = rules.find(rule => rule.selectorText.endsWith(' .international-map-image'));
    assert.match(imageRule.selectorText, /^\.map\[data-regional-map="international"\]/);
    assert.match(imageRule.style.getPropertyValue('filter'), /international-atlas-filter\.svg.*#atlas/);
    const logoRule = rules.find(rule => rule.selectorText.endsWith(' .international-map-logo'));
    assert.equal(logoRule.style.getPropertyValue('filter'), 'none');
    assert.match(logoRule.style.getPropertyValue('background-image'), /mapbox-logo\.svg/);
    assert.equal(w.document.querySelector('.international-map-logo').href, 'https://www.mapbox.com/');
    assert.equal(w.document.querySelectorAll('.international-map-credit a').length, 3);
});

test('Canadian regional labels retain full names and wrap rather than ellipsize', t => {
    const { layer, w } = setup(t);
    for (const [name, lat, lon] of [['Yellowknife', 62.45, -114.38], ['Fort Simpson', 61.86, -121.35],
        ['Saint-Louis-du-Ha! Ha!', 47.67, -68.98]]) {
        const view = layer.layout({ displayname: name, lat, lon, country: 'Canada' }, []);
        assert.equal(view.cities[0].name, name);
        assert.equal(view.cities[0].left, 708, 'card remains centered on the geographic point');
    }
    const style = w.document.createElement('style');
    style.textContent = read('webroot/css/regional-map.css');
    w.document.head.append(style);
    const labels = Array.from(style.sheet.cssRules).find(rule => rule.selectorText.endsWith(' .city-name'));
    assert.equal(labels.style.getPropertyValue('width'), 'max-content');
    assert.equal(labels.style.getPropertyValue('white-space'), 'normal');
    assert.equal(labels.style.getPropertyValue('overflow-wrap'), 'anywhere');
    assert.notEqual(labels.style.getPropertyValue('text-overflow'), 'ellipsis');
});

test('Mercator city positions align with the camera, avoid collisions and wrap the dateline', t => {
    const { layer } = setup(t);
    const view = layer.layout(london, [...londonRegion, london, { name: 'Wrong US city', lat: 40.7, lon: -74 }]);
    assert.equal(view.cities[0].name, 'London');
    assert.ok(view.cities.length > 1);
    const center = layer.project(london, view);
    assert.ok(Math.abs(center.x - 810) < 0.1 && Math.abs(center.y - 450) < 0.1);
    for (const city of view.cities) {
        const p = layer.project(city, view);
        assert.ok(Math.abs(city.left + 102 - p.x) <= 0.5);
        assert.ok(Math.abs(city.top + 81 - p.y) <= 0.5);
        assert.ok(city.top >= 185 && city.top + 162 <= 820);
        assert.notEqual(city.name, 'Wrong US city');
    }
    const crossing = layer.project({ lat: -17, lon: -179.9 }, { lat: -17, lon: 179.9, zoom: 6 });
    assert.ok(Math.abs(crossing.x - 810) < 50, 'nearest wrapped longitude, not a jump across the world');
    const polar = layer.layout({ displayname: 'Polar', lat: 89, lon: 25 }, []);
    assert.ok(polar.lat <= 85.0511 && Number.isFinite(polar.zoom));
});

test('international list bypasses US atlas, reuses images and restores the authored US layout', t => {
    const { w, layer, images, setCity } = setup(t);
    setCity(london, londonRegion);
    w.sortRegionalList();
    assert.equal(w.locationConfig.regionalMap.map[0].name, 'London');
    assert.equal(w.document.querySelector('.map').dataset.regionalMap, 'international');
    assert.equal(w.document.getElementById('mapleftvalue').disabled, true);
    assert.equal(images.length, 1);
    images[0].onload();
    assert.equal(w.document.querySelector('.international-regional-map').dataset.state, 'ready');
    layer.prepare(); layer.render();
    assert.equal(images.length, 1, 'Tonight/Tomorrow use the same background request');
    setCity({ displayname: 'Corvallis', lat: 44.56, lon: -123.26, country: 'United States' });
    w.sortRegionalList();
    assert.equal(w.document.querySelector('.map').dataset.regionalMap, 'domestic');
    assert.equal(w.document.querySelector('.international-regional-map').hidden, true);
    assert.equal(w.document.getElementById('mapleftvalue').disabled, false);
    assert.ok(w.locationConfig.regionalMap.map.length > 0);
    assert.ok(w.locationConfig.regionalMap.map.every(city => Math.abs(city.lon) > 60));
    assert.notEqual(w.locationConfig.regionalMap.leftPos, 0);
    assert.equal(w.document.querySelector('.map-regional .merc').getAttribute('src'), 'images/maps/regional_map.png');
});

test('late static responses, missing token, errors and timeouts never reveal a stale US map', t => {
    const { w, layer, images, timers, setCity } = setup(t);
    setCity(london); layer.prepare();
    const old = images[0];
    setCity({ displayname: 'Tokyo', lat: 35.68, lon: 139.69 }); layer.prepare();
    old.onload();
    assert.equal(w.document.querySelector('.international-regional-map').dataset.state, 'loading');
    images[1].onerror();
    assert.equal(w.document.querySelector('.international-regional-map').dataset.state, 'error');
    layer.render();
    assert.equal(images.length, 2, 'failed images do not retry on every slide');
    setCity(london); layer.prepare();
    [...timers.values()].at(-1)();
    assert.equal(w.document.querySelector('.international-regional-map').dataset.state, 'error');
    images.at(-1).onload();
    assert.equal(images.at(-1).hidden, true, 'timed-out image stays hidden');
    w.map_key = '';
    setCity({ displayname: 'Sydney', lat: -33.86, lon: 151.2 }); layer.prepare();
    assert.match(w.document.querySelector('.international-map-status').textContent, /Mapbox public token/);
    assert.equal(w.document.querySelector('.map').dataset.regionalMap, 'international');
});

test('manual US map settings remain untouched, international overrides use copied coordinates', t => {
    const { w, layer, setCity } = setup(t);
    const custom = [{ name: 'Oxford', lat: 51.752, lon: -1.2577, left: 9000, top: -600 }];
    w.locationSettings.mapCities = { autoFind: false, map: custom, leftPos: -800, topPos: 100 };
    setCity(london); layer.prepare();
    assert.equal(custom[0].left, 9000);
    assert.equal(w.locationSettings.mapCities.leftPos, -800);
    setCity({ displayname: 'Portland', lat: 45.52, lon: -122.67, country: 'United States' });
    assert.equal(layer.prepare(), false);
    assert.equal(w.locationSettings.mapCities.map, custom);
});

test('map weather requests use international coordinates and discard previous-region replies', t => {
    const { w, layer, setCity, load } = setup(t);
    load('webroot/js/weather.js');
    const requests = [];
    w.$.getJSON = (url, callback) => { requests.push({ url, callback }); };
    setCity(london, londonRegion); layer.prepare(); w.grabMapCityData();
    const firstCities = w.locationConfig.regionalMap.map.slice();
    assert.match(requests[0].url, /geocodes=51\.5074,-0\.1278/);
    const forecast = { daypart: [{ temperature: [10, 15], iconCodeExtend: [400, 400], daypartName: ['Tonight', 'Tomorrow'] }], dayOfWeek: ['Tuesday', 'Wednesday'] };
    const response = firstCities.map(() => ({ 'v3-wx-forecast-daily-3day': forecast, 'v3-wx-observations-current': { temperature: 9, iconCodeExtend: 400 } }));
    requests[0].callback(response);
    assert.equal(w.weatherInfo.map.mapCities[0].name, 'London');
    assert.equal(w.weatherInfo.map.mapCities[0].forecasts[0].temp, 10);
    setCity({ displayname: 'Tokyo', lat: 35.68, lon: 139.69 }); layer.prepare(); w.grabMapCityData();
    requests[0].callback(response);
    assert.equal(w.weatherInfo.map.mapCities.length, 0);
    requests[1].callback([{ 'v3-wx-forecast-daily-3day': forecast }]);
    assert.equal(w.weatherInfo.map.mapCities[0].name, 'Tokyo');
    assert.equal(w.weatherInfo.map.mapCities[0].current.icon, 'blank');
});

test('forecast slide keeps its theme/header, labels and weather when static image fails', t => {
    const { w, layer, load, images, setCity } = setup(t);
    load('webroot/js/weather.js'); load('webroot/js/slides.js');
    setCity(london); layer.prepare(); images[0].onerror();
    w.getIcon = () => {};
    w.slideLength = 8000;
    w.weatherInfo.map.days = ['Tonight', 'Tomorrow'];
    w.weatherInfo.map.mapCities = [{ forecasts: [{ temp: 10, icon: 400 }, { temp: 15, icon: 400 }] }];
    w.document.documentElement.dataset.theme = '2005-2006';
    w.slidePrograms.mapForecast(0);
    assert.equal(w.document.querySelector('.map .header').textContent, "Tonight's Forecast");
    assert.equal(w.document.querySelector('.map-cities .city.i .city-name').textContent, 'London');
    assert.equal(w.document.querySelector('.map-cities .city.i .temp').textContent, '10');
    w.slidePrograms.mapForecast(1);
    assert.equal(w.document.querySelector('.map .header').textContent, "Tomorrow's Forecast");
    assert.equal(w.document.querySelector('.map-cities .city.i .temp').textContent, '15');
    assert.equal(w.document.documentElement.dataset.theme, '2005-2006');
    assert.equal(w.appearanceSettings.graphicsPackage, 2010, 'renderer never changes the selected package');
});

test('a missing token is reported on the first international selection', t => {
    const { w, layer, images, setCity } = setup(t);
    w.map_key = '';
    setCity(london); layer.prepare();
    assert.equal(images.length, 0);
    assert.match(w.document.querySelector('.international-map-status').textContent, /Mapbox public token/);
    assert.equal(w.document.querySelector('.international-regional-map').dataset.state, 'error');
});

test('regional requests do not stall the pre-existing background weather loop', { timeout: 1000 }, async t => {
    const { w, setCity, load } = setup(t);
    load('webroot/js/weather.js');
    setCity(london);
    w.$.getJSON = () => new Promise(() => {}); // Simulate a stalled external weather API.
    await w.grabMapCityData();
    assert.equal(w.weatherInfo.map.mapCities.length, 0);
});
