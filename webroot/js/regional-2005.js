// 2005 Regional graphics package.
// Owns the fixed product order, the city forecast feed, and the Monday, 3-day,
// regional radar, and thunderstorm slides. Loaded after slides.js, which owns
// the scheduler (slideSchedule, showSlide, hideSlide, slideCallBack).
// Only the 2005 Regional package uses this file; other packages never reach it.

const REGIONAL_PACKAGE = '2005-regional';

// Twenty-two cities cover every slide in the reference set. Coordinates are
// public city centers; the forecast feed resolves them by geocode.
const REGIONAL_CITIES = [
    { name: 'Boston', lat: 42.3601, lon: -71.0589 },
    { name: 'New York City', lat: 40.7128, lon: -74.0060 },
    { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
    { name: 'Washington, DC', lat: 38.9072, lon: -77.0369 },
    { name: 'Cleveland', lat: 41.4993, lon: -81.6944 },
    { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
    { name: 'Detroit', lat: 42.3314, lon: -83.0458 },
    { name: 'Minneapolis', lat: 44.9778, lon: -93.2650 },
    { name: 'Atlanta', lat: 33.7490, lon: -84.3880 },
    { name: 'Miami', lat: 25.7617, lon: -80.1918 },
    { name: 'Orlando', lat: 28.5383, lon: -81.3792 },
    { name: 'Tampa', lat: 27.9506, lon: -82.4572 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Sacramento', lat: 38.5816, lon: -121.4944 },
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
    { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
    { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
    { name: 'Denver', lat: 39.7392, lon: -104.9903 },
    { name: 'Houston', lat: 29.7604, lon: -95.3698 },
    { name: 'Phoenix', lat: 33.4484, lon: -112.0740 },
    { name: 'Baltimore', lat: 39.2904, lon: -76.6122 },
    { name: 'Birmingham', lat: 33.5186, lon: -86.8104 },
];

// Five Monday slides. Eastern, central, and mountain cities use 6 pm, 9 pm,
// and midnight; the Pacific slide uses 3, 6, and 9 pm as in the reference.
const REGIONAL_MONDAY_SLIDES = [
    { cities: ['Boston', 'New York City', 'Philadelphia', 'Washington, DC'], hours: [18, 21, 0] },
    { cities: ['Cleveland', 'Chicago', 'Detroit', 'Minneapolis'], hours: [18, 21, 0] },
    { cities: ['Atlanta', 'Miami', 'Orlando', 'Tampa'], hours: [18, 21, 0] },
    { cities: ['Los Angeles', 'Sacramento', 'San Francisco', 'Seattle'], hours: [15, 18, 21] },
    { cities: ['Dallas', 'Denver', 'Houston', 'Phoenix'], hours: [18, 21, 0] },
];

// Five three-day slides with four cities each.
const REGIONAL_THREE_DAY_SLIDES = [
    ['Atlanta', 'Baltimore', 'Birmingham', 'Boston'],
    ['Chicago', 'Cleveland', 'Dallas', 'Denver'],
    ['Detroit', 'Houston', 'Los Angeles', 'Miami'],
    ['Minneapolis', 'New York City', 'Orlando', 'Philadelphia'],
    ['Phoenix', 'Sacramento', 'San Francisco', 'Seattle'],
];

// Bounds are [west, south, east, north] in degrees, in the order requested.
const REGIONAL_RADAR_REGIONS = [
    { name: 'Northeast', bounds: [-80.8, 38.6, -66.6, 47.7] },
    { name: 'Southeast', bounds: [-91.8, 24.4, -74.0, 39.2] },
    { name: 'Midwest', bounds: [-98.5, 36.0, -80.0, 49.6] },
    { name: 'South', bounds: [-106.8, 25.6, -88.0, 37.6] },
    { name: 'Southwest', bounds: [-124.8, 31.0, -102.8, 42.2] },
    { name: 'Northwest', bounds: [-125.0, 40.0, -110.0, 49.6] },
];

// PLACEHOLDER risk areas, in percent of the map frame. These are illustrative
// shapes only, not a forecast. Replace them with a real risk outlook feed
// before using this slide on air.
const REGIONAL_STORM_ZONES = Object.freeze({
    thunderstorms: [
        'M 12 20 L 30 14 L 36 30 L 33 48 L 28 60 L 16 58 L 10 40 Z',
        'M 33 18 L 56 16 L 60 36 L 56 58 L 46 64 L 36 52 Z',
        'M 52 60 L 74 58 L 80 72 L 74 80 L 58 78 Z',
        'M 76 30 L 88 28 L 90 42 L 82 48 Z',
    ],
    severe: [
        'M 44 26 L 58 26 L 60 40 L 52 46 L 44 40 Z',
        'M 84 40 L 90 38 L 91 46 L 85 50 Z',
    ],
});

const regionalFlavor = Object.freeze({
    flavor: 'regional',
    bulletin: false,
    precip: false,
    order: [
        { function: 'regionalMonday', slides: REGIONAL_MONDAY_SLIDES.length, slideDelay: 8000 },
        { function: 'regionalThreeDay', slides: REGIONAL_THREE_DAY_SLIDES.length, slideDelay: 8000 },
        { function: 'regionalRadar', slides: REGIONAL_RADAR_REGIONS.length, slideDelay: 8000 },
        { function: 'regionalThunder', slideDelay: 8000 },
    ],
});

let regionalRequest = 0;
let regionalForecast = { mondayTitle: '', monday: [], threeDay: [] };

function regionalIsActive() {
    return document.documentElement.dataset.package === REGIONAL_PACKAGE;
}

function regionalEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function regionalHourLabel(hour) {
    if (hour === 0) return 'Midnight';
    if (hour === 12) return 'Noon';
    return `${hour % 12} ${hour < 12 ? 'am' : 'pm'}`;
}

// Hourly entries from the single-location hourly feed, as { date, hour, temp, icon }.
function regionalHourly(hourly) {
    const times = hourly?.validTimeLocal;
    if (!Array.isArray(times)) return [];
    return times.map((iso, i) => {
        const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(iso || '');
        if (!match) return null;
        return {
            date: match[1],
            hour: Number(match[2]),
            temp: hourly.temperature?.[i],
            icon: hourly.iconCodeExtend?.[i] ?? hourly.iconCode?.[i],
        };
    }).filter(Boolean);
}

// Picks the first matching entry for each requested hour, moving forward so
// midnight lands on the next day. A missing hour leaves a null slot.
function regionalPeriods(entries, hours) {
    const picked = [];
    let cursor = 0;
    for (const hour of hours) {
        let j = cursor;
        while (j < entries.length && entries[j].hour !== hour) j++;
        if (j < entries.length) {
            picked.push(entries[j]);
            cursor = j + 1;
        } else {
            picked.push(null);
        }
    }
    return picked;
}

// Column names come from the browser's calendar so the first column is always
// today, not whichever day the feed happens to list first.
function regionalDayName(offset) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    return day.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3).toUpperCase();
}

// Daily aggregate item: day highs and nights alternate in daypart[0].temperature,
// with the day-level max and min arrays preferred when the feed supplies them.
function regionalDaily(item) {
    const daily = item?.['v3-wx-forecast-daily-3day'];
    const part = daily?.daypart?.[0];
    return [0, 1, 2].map(i => ({
        name: regionalDayName(i),
        high: daily?.temperatureMax?.[i] ?? part?.temperature?.[i * 2] ?? '',
        low: daily?.temperatureMin?.[i] ?? part?.temperature?.[i * 2 + 1] ?? '',
        // A missing daytime icon falls back to the night icon for the same day.
        icon: part?.iconCodeExtend?.[i * 2] ?? part?.iconCodeExtend?.[i * 2 + 1] ?? null,
    }));
}

// A failed request resolves to null so one city never stalls the whole refresh.
function regionalGet(url) {
    return $.ajax({ url, dataType: 'json', timeout: 15000 }).then(data => data, () => null);
}

async function grabRegionalForecast() {
    if (!regionalIsActive()) return;
    const request = ++regionalRequest;
    const geocodes = REGIONAL_CITIES.map(city => `${city.lat},${city.lon}`).join(';');
    const dailyUrl = 'https://api.weather.com/v3/aggcommon/v3-wx-forecast-daily-3day?geocodes=' +
        geocodes + '&language=en-US&units=e&format=json&apiKey=' + api_key;
    const hourlyUrls = REGIONAL_CITIES.map(city =>
        `https://api.weather.com/v3/wx/forecast/hourly/2day?geocode=${city.lat},${city.lon}&format=json&units=e&language=en-US&apiKey=${api_key}`);
    const [daily, ...hourly] = await Promise.all([regionalGet(dailyUrl), ...hourlyUrls.map(regionalGet)]);
    // A response for an earlier refresh must never replace a newer one.
    if (request !== regionalRequest) return;
    // Keep the last good forecast on screen when every request failed.
    if (!Array.isArray(daily) && hourly.every(item => !item)) return;

    const dailyByName = {};
    const hourlyByName = {};
    REGIONAL_CITIES.forEach((city, i) => {
        dailyByName[city.name] = Array.isArray(daily) ? daily[i] : null;
        hourlyByName[city.name] = hourly[i] || null;
    });

    // The title names today, matching the first forecast column.
    const mondayTitle = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const monday = REGIONAL_MONDAY_SLIDES.map(group => group.cities.map(name => {
        const periods = regionalPeriods(regionalHourly(hourlyByName[name]), group.hours);
        return {
            name,
            periods: group.hours.map((hour, i) => ({
                label: regionalHourLabel(hour),
                temp: periods[i]?.temp ?? '',
                icon: periods[i]?.icon ?? 'blank',
            })),
        };
    }));

    const threeDay = REGIONAL_THREE_DAY_SLIDES.map(names => names.map(name => ({
        name,
        days: regionalDaily(dailyByName[name]),
    })));

    // Slides are built once at load; new data is drawn when each slide starts.
    regionalForecast = { mondayTitle, monday, threeDay };
}

function regionalSlideSelector(kind, index) {
    return `.rg-slide[data-kind="${kind}"][data-index="${index}"]`;
}

function regionalBuildSlides() {
    $('.slides > .rg-slide').remove();
    const container = $('.slides');
    REGIONAL_MONDAY_SLIDES.forEach((group, index) => {
        const blocks = group.cities.map((name, c) => {
            const cells = [0, 1, 2].map(p => `
                <div class="rg-cell">
                    <div class="rg-time"></div>
                    <div class="rg-icon"></div>
                    <div class="rg-temp"></div>
                </div>`).join('');
            return `<div class="rg-block" data-pos="${c}"><div class="rg-city">${regionalEscape(name)}</div><div class="rg-cells">${cells}</div></div>`;
        }).join('');
        container.append(`<div class="rg-slide rg-monday" data-kind="monday" data-index="${index}" style="display:none"><div class="rg-title"></div>${blocks}</div>`);
    });
    REGIONAL_THREE_DAY_SLIDES.forEach((names, index) => {
        // Rows sit 132 px apart, starting below the day header, as in the reference.
        const rows = names.map((name, r) => `
            <div class="rg-row" style="top:${215 + r * 132}px"><div class="rg-city">${regionalEscape(name)}</div>
                ${[0, 1, 2].map(() => `<div class="rg-cell"><div class="rg-hilo"><span class="rg-hi"></span><span class="rg-lo"></span></div><div class="rg-icon"></div></div>`).join('')}
            </div>`).join('');
        container.append(`<div class="rg-slide rg-three" data-kind="three" data-index="${index}" style="display:none"><div class="rg-title">3 Day Forecast</div><div class="rg-days"><span></span>${[0, 1, 2].map(() => '<span class="rg-day"></span>').join('')}</div>${rows}</div>`);
    });
    const zones = (paths, cls) => paths.map(d => `<path class="${cls}" d="${d}"/>`).join('');
    container.append(`
        <div class="rg-slide rg-thunder" data-kind="thunder" data-index="0" style="display:none">
            <div class="rg-title">THUNDERSTORM FORECAST</div>
            <div class="rg-legend"><span class="rg-key">THUNDERSTORMS <i class="rg-swatch rg-swatch-storm"></i></span><span class="rg-key">SEVERE <i class="rg-swatch rg-swatch-severe"></i></span><span class="rg-period">Tonight</span></div>
            <div class="rg-map">
                <img src="images/maps/regional_map.png" alt="" draggable="false">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" data-placeholder="true" aria-hidden="true">
                    ${zones(REGIONAL_STORM_ZONES.thunderstorms, 'rg-zone-storm')}
                    ${zones(REGIONAL_STORM_ZONES.severe, 'rg-zone-severe')}
                </svg>
            </div>
        </div>`);
}

function regionalRender(kind, index) {
    const slide = $(regionalSlideSelector(kind, index));
    if (kind === 'monday') {
        const data = regionalForecast.monday[index] || [];
        const title = regionalForecast.mondayTitle || new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        slide.find('.rg-title').text(`${title} FORECAST`);
        slide.find('.rg-block').each(function (c) {
            const city = data[c];
            const block = $(this);
            block.find('.rg-city').text(city ? city.name : '');
            (city ? city.periods : []).forEach((period, p) => {
                const cell = block.find('.rg-cell').eq(p);
                cell.find('.rg-time').text(period.label);
                cell.find('.rg-temp').text(period.temp);
                // Static stills: this package never animates its forecast icons.
                getIcon(cell.find('.rg-icon'), period.icon, 'forecast', 'stills');
            });
        });
    } else if (kind === 'three') {
        const data = regionalForecast.threeDay[index] || [];
        const first = data[0]?.days || [];
        slide.find('.rg-day').each(function (d) { $(this).text(first[d]?.name || ''); });
        slide.find('.rg-row').each(function (r) {
            const days = data[r]?.days || [];
            $(this).find('.rg-cell').each(function (d) {
                const day = days[d];
                $(this).find('.rg-hi').text(day?.high ?? '');
                $(this).find('.rg-lo').text(day?.low ?? '');
                getIcon($(this).find('.rg-icon'), day?.icon ?? 'blank', 'forecast', 'stills');
            });
        });
    }
}


// Radar tile prefetch. While one region is on air, the next region's tiles for
// the same history frames are requested into the browser cache, so the switch
// does not wait on every tile. Only the 2005 Regional package calls this.
const REGIONAL_TILE_MIN_ZOOM = 5; // the raster source's minzoom in radar.js
const REGIONAL_TILE_MAX_ZOOM = 12;
const REGIONAL_PREFETCH_LIMIT = 600;
// Longest a new regional radar view stays hidden while its base map loads.
const REGIONAL_REVEAL_CAP_MS = 2500;

function regionalLonToTileX(lon, z) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, z));
}

function regionalLatToTileY(lat, z) {
    const rad = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

// Tile URLs covering bounds [west, south, east, north] for each timestamp.
// 512 px tiles load one zoom level below the map zoom, clamped to the source range.
function regionalTileUrls(bounds, mapZoom, timestamps, apiKey) {
    const [west, south, east, north] = bounds;
    const z = Math.min(REGIONAL_TILE_MAX_ZOOM, Math.max(REGIONAL_TILE_MIN_ZOOM, Math.floor(mapZoom) - 1));
    const x0 = regionalLonToTileX(west, z), x1 = regionalLonToTileX(east, z);
    const y0 = regionalLatToTileY(north, z), y1 = regionalLatToTileY(south, z);
    const urls = [];
    for (const ts of timestamps) {
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                if (urls.length >= REGIONAL_PREFETCH_LIMIT) return urls;
                urls.push(`https://api.weather.com/v3/TileServer/tile/twcRadarMosaic?ts=${ts}&xyz=${x}:${y}:${z}&apiKey=${apiKey}`);
            }
        }
    }
    return urls;
}

// Base map sources are everything except the radar frame sources.
function regionalBaseReady(map) {
    if (!map || !map.isStyleLoaded()) return false;
    const sources = Object.keys(map.getStyle().sources).filter(id => !id.startsWith('radar_'));
    return sources.every(id => map.isSourceLoaded(id));
}

function regionalFrameLoaded(map) {
    const state = radarState(map);
    return (state.timestamps || []).some(ts => radarFrameReady(map, ts));
}

// Reveals the regional radar group when the base map and one frame are ready,
// or after a bounded wait so a slow network never leaves the slide hidden.
function regionalHoldUntilReady(group, started = Date.now()) {
    const map = window.regradar;
    const ready = map && regionalBaseReady(map) && regionalFrameLoaded(map);
    if (ready || Date.now() - started > REGIONAL_REVEAL_CAP_MS) {
        group.css('visibility', '');
        return;
    }
    setTimeout(() => regionalHoldUntilReady(group, started), 100);
}

function regionalPrefetchRadar(index) {
    const next = REGIONAL_RADAR_REGIONS[(index + 1) % REGIONAL_RADAR_REGIONS.length];
    const map = window.regradar;
    if (!regionalIsActive() || !map || typeof map.cameraForBounds !== 'function') return;
    if (!Array.isArray(window.regtimestamps) || !window.regtimestamps.length) return;
    const camera = map.cameraForBounds([[next.bounds[0], next.bounds[1]], [next.bounds[2], next.bounds[3]]], { duration: 0 });
    if (!camera) return;
    regionalTileUrls(next.bounds, camera.zoom, window.regtimestamps, api_key).forEach(url => {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
    });
}

// Points the existing regional radar maps at one region. The maps and their
// frames are unchanged; only the camera moves.
function regionalSetRadarView(region) {
    const [west, south, east, north] = region.bounds;
    const view = [[west, south], [east, north]];
    for (const map of [window.regradar, window.regmap, window.regoutlines, window.regoutlinestrans]) {
        if (map && typeof map.fitBounds === 'function') map.fitBounds(view, { duration: 0, animate: false });
    }
}

function regionalShowPage(kind, index, nextPage) {
    const count = slideFlavor.order[idx]?.slides || 1;
    const page = $(regionalSlideSelector(kind, index));
    regionalRender(kind, index);
    showSlide(page);
    slideSchedule(() => {
        hideSlide(page);
        if (index >= count - 1) slideCallBack();
        else nextPage(index + 1);
    }, slideLength);
}

Object.assign(slidePrograms, {
    regionalMonday(index = 0) {
        regionalShowPage('monday', index, next => slidePrograms.regionalMonday(next));
    },
    regionalThreeDay(index = 0) {
        regionalShowPage('three', index, next => slidePrograms.regionalThreeDay(next));
    },
    regionalRadar(index = 0) {
        const count = slideFlavor.order[idx]?.slides || 1;
        const region = REGIONAL_RADAR_REGIONS[index];
        // No voice on this package's radar: the regional radar plays no audio cue.
        regionalSetRadarView(region);
        // Start after this region's first frames have begun loading.
        setTimeout(() => regionalPrefetchRadar(index), 1500);
        const last = index >= count - 1;
        showRadarSlide('regional', () => {
            if (last) slideCallBack();
            else slidePrograms.regionalRadar(index + 1);
        }, !last);
    },
    regionalThunder() {
        const page = $(regionalSlideSelector('thunder', 0));
        showSlide(page);
        slideSchedule(() => {
            hideSlide(page);
            slideCallBack();
        }, slideLength);
    },
});

// Slide markup exists before the first data pass; jQuery ready runs after the body is parsed.
$(regionalBuildSlides);
