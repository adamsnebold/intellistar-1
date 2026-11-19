// Regional forecast background only. This does not create/change live radar maps
// or graphics-package styles. Static Images and label placement share one camera.
var regionalMapLayer = (() => {
    const WIDTH = 1620, HEIGHT = 900, IMAGE_WIDTH = 1080, IMAGE_HEIGHT = 600;
    const CARD_WIDTH = 204, CARD_HEIGHT = 162; // 75% of the authored 272×216 card
    const MAX_LAT = 85.0511;
    const STYLE = 'mapbox/outdoors-v12';
    let camera = null, requestKey = null, generation = 0, timeout, retryAfter = 0;

    function coordinates(city) {
        if (!city || [city.lat, city.lon].some(value =>
            !['number', 'string'].includes(typeof value) || String(value).trim() === '')) return null;
        const lat = Number(city.lat), lon = Number(city.lon);
        return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
            ? { lat, lon } : null;
    }

    function needsStatic(city) {
        const point = coordinates(city);
        if (!point) return false;
        // Coverage of the authored contiguous-US grid, not all US territories.
        const outside = point.lon < -125 || point.lon > -66 || point.lat < 24 || point.lat > 50;
        const country = String(city.countryCode || city.country || '').trim().toUpperCase();
        const foreign = country && !['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(country);
        return Boolean(outside || foreign);
    }

    function mercator(point) {
        const latitude = Math.max(-MAX_LAT, Math.min(MAX_LAT, point.lat)) * Math.PI / 180;
        return { x: (point.lon + 180) / 360, y: (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2 };
    }

    function delta(a, b) {
        let x = a.x - b.x;
        if (x > 0.5) x -= 1;
        if (x < -0.5) x += 1;
        return { x, y: a.y - b.y };
    }

    function distance(a, b) {
        const rad = Math.PI / 180;
        const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
        return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
    }

    function project(city, view) {
        const d = delta(mercator(coordinates(city)), mercator(view));
        const world = 512 * 2 ** view.zoom;
        return { x: WIDTH / 2 + d.x * world * WIDTH / IMAGE_WIDTH,
            y: HEIGHT / 2 + d.y * world * HEIGHT / IMAGE_HEIGHT };
    }

    function layout(main, nearby) {
        const point = coordinates(main);
        if (!point) return null;
        const center = { lon: point.lon, lat: Math.max(-MAX_LAT, Math.min(MAX_LAT, point.lat)) };
        const seen = new Set();
        const candidates = [main, ...nearby].filter(city => {
            const p = coordinates(city);
            if (!p || distance(point, p) > 350) return false;
            const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 10);
        let zoom = candidates.length > 1 ? 8.5 : 6.7;
        for (const city of candidates) {
            const d = delta(mercator(coordinates(city)), mercator(center));
            if (d.x) zoom = Math.min(zoom, Math.log2(360 / (512 * Math.abs(d.x))));
            if (d.y) zoom = Math.min(zoom, Math.log2(120 / (512 * Math.abs(d.y))));
        }
        // Round the camera BEFORE projection: API and HTML must use identical values.
        const view = { lon: Number(center.lon.toFixed(5)), lat: Number(center.lat.toFixed(5)),
            zoom: Number(Math.max(3, Math.min(8.5, zoom)).toFixed(2)) };
        const cities = [], occupied = [];
        for (const city of candidates) {
            const p = project(city, view);
            const entry = { name: city.displayname || city.name || 'Location', ...coordinates(city),
                left: Math.round(p.x - CARD_WIDTH / 2), top: Math.round(p.y - CARD_HEIGHT / 2) };
            // Do not displace geographic points to resolve collisions: retain the
            // main city and omit overlapping/offscreen weather cards. Native map
            // labels still identify the surrounding towns and landmarks.
            if (entry.left < 80 || entry.left + CARD_WIDTH > 1540 || entry.top < 185 || entry.top + CARD_HEIGHT > 820) continue;
            // Full names can extend past the weather icon's card. Reserve space
            // for their centered, wrapping label rather than truncating the name
            // or shifting the actual geographic position.
            const estimatedWidth = entry.name.length * 22 + 20;
            const labelWidth = Math.min(360, estimatedWidth);
            const rows = Math.ceil(estimatedWidth / 360);
            const bounds = {
                left: Math.min(entry.left, p.x - labelWidth / 2),
                right: Math.max(entry.left + CARD_WIDTH, p.x + labelWidth / 2),
                top: Math.min(entry.top, entry.top + 39 - rows * 41),
                bottom: entry.top + CARD_HEIGHT
            };
            if (bounds.left < 30 || bounds.right > 1590 || bounds.top < 180) continue;
            if (occupied.some(other => bounds.left < other.right + 10 && bounds.right + 10 > other.left &&
                bounds.top < other.bottom + 10 && bounds.bottom + 10 > other.top)) continue;
            occupied.push(bounds);
            cities.push(entry);
        }
        return { ...view, cities };
    }

    function buildURL(view, token) {
        // Outdoors is a flat, globally available classic style (not satellite/3D).
        // Emphasize country/region boundaries using its existing Streets source.
        const boundaryLayer = { id: 'intellistar-regional-boundaries', type: 'line', source: 'composite',
            'source-layer': 'admin', filter: ['in', ['get', 'admin_level'], ['literal', [2, 4]]],
            paint: { 'line-color': '#303e32', 'line-width': 1.6, 'line-opacity': 0.85 } };
        // Required wordmark and credits are rendered separately, unchanged by
        // the atlas image color grade (see .international-map-logo in the HTML).
        const query = new URLSearchParams({ access_token: token, attribution: 'false', logo: 'false',
            addlayer: JSON.stringify(boundaryLayer) });
        return `https://api.mapbox.com/styles/v1/${STYLE}/static/${view.lon},${view.lat},${view.zoom},0,0/${IMAGE_WIDTH}x${IMAGE_HEIGHT}@2x?${query}`;
    }

    function render() {
        const map = document.querySelector('.map');
        if (!map) return;
        const international = needsStatic(locationConfig.mainCity) && camera !== null;
        const layer = map.querySelector('.international-regional-map');
        map.dataset.regionalMap = international ? 'international' : 'domestic';
        layer.hidden = !international;
        // Pixel offsets belong to the US atlas only. International maps are centered
        // geographically; don't allow the US grid controls to shift a hidden layer.
        for (const id of ['mapleftvalue', 'maptopvalue']) {
            const control = document.getElementById(id);
            if (control) control.disabled = international;
        }
        if (!international) {
            generation++;
            clearTimeout(timeout);
            requestKey = null;
            layer.querySelector('img')?.remove();
            return;
        }
        const cityLayer = map.querySelector('.map-cities');
        cityLayer.style.left = '0px';
        cityLayer.style.top = '0px';
        const url = map_key ? buildURL(camera, map_key) : '';
        if (requestKey === url && (layer.dataset.state !== 'error' || Date.now() < retryAfter)) return;
        requestKey = url;
        const current = ++generation;
        clearTimeout(timeout);
        layer.querySelector('img')?.remove();
        const status = layer.querySelector('.international-map-status');
        status.hidden = false;
        layer.dataset.state = 'loading';
        status.textContent = 'Loading regional map…';
        const fail = () => {
            if (current !== generation) return;
            clearTimeout(timeout);
            layer.dataset.state = 'error';
            retryAfter = Date.now() + 60000;
            status.textContent = map_key ? 'Regional map unavailable — weather remains available' : 'Regional map needs a Mapbox public token';
        };
        if (!url) { fail(); return; }
        const image = new Image();
        image.className = 'international-map-image';
        image.alt = '';
        image.hidden = true;
        image.onload = () => {
            if (current !== generation || layer.dataset.state === 'error') return;
            clearTimeout(timeout);
            layer.dataset.state = 'ready';
            status.hidden = true;
            image.hidden = false;
        };
        image.onerror = fail;
        layer.prepend(image);
        timeout = setTimeout(fail, 12000);
        image.src = url;
    }

    function prepare() {
        if (!needsStatic(locationConfig.mainCity)) {
            camera = null;
            render();
            return false;
        }
        const manual = locationSettings.mapCities.autoFind === false;
        const nearby = manual ? (locationSettings.mapCities.map || []) : (locationConfig.eightCities.cities || []);
        camera = layout(locationConfig.mainCity, nearby);
        locationConfig.regionalMap.map = camera.cities;
        locationConfig.regionalMap.leftPos = 0;
        locationConfig.regionalMap.topPos = 0;
        render();
        return true;
    }

    return { coordinates, needsStatic, layout, project, buildURL, prepare, render };
})();
