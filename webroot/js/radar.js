var regradar, locradar, radarsat,
  regoutlines, locoutlines, regoutlinestrans, locoutlinestrans,
  regmap, locmap,
  regtimestamps, loctimestamps, sattimestamps,
  radarAnimation; // The sole requestAnimationFrame handle, cancelled at slide exit.
mapboxgl.accessToken = map_key;
var mapStyle = "mapbox://styles/colster/cmiccqynn00as01s4bt6501il";

async function createMaps() {
  stopRadar();
  for (const map of [regradar, locradar, regmap, locmap, regoutlines, locoutlines, regoutlinestrans, locoutlinestrans]) {
    if (map) map.remove();
  }
  // Give hidden canvases their real dimensions without ever exposing the radar
  // panel. Restore synchronously, before the browser can paint or a slide starts.
  const elements = [document.querySelector('.radar'), ...document.querySelectorAll(
    '.radar-group, #regradar, #regmap, #regoutlines, #regoutlinestrans, #locradar, #locmap, #locoutlines, #locoutlinestrans')];
  const styles = elements.map(element => [element, element.style.display, element.style.visibility]);
  for (const [element] of styles) {
    element.style.display = 'block';
    element.style.visibility = 'hidden';
  }
  try {
    mapboxgl.accessToken = map_key;
    var radarCoords = [
      !locationConfig.mainCity.lon || !locationConfig.mainCity.lat ? 0 : locationConfig.mainCity.lon,
      !locationConfig.mainCity.lat || !locationConfig.mainCity.lon ? 0 : locationConfig.mainCity.lat
    ]
    regradar = new mapboxgl.Map({
      container: "regradar",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 7.7,
      center: radarCoords
    });

    regradar.on("style.load", () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        regradar.setLayoutProperty('background', 'visibility', 'none');//ocean
        regradar.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        regradar.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        regradar.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        regradar.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        regradar.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        regradar.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'none');//county lines
        regradar.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'none');//state lines
        regradar.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'none');//coastlines
        regradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        regradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'none');//gray roads
        regradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        regradar.setLayoutProperty('place-label', 'visibility', 'none');
        regradar.setLayoutProperty('place-label copy', 'visibility', 'none');
        regradar.setLayoutProperty('airport-label', 'visibility', 'none');
        regradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        regradar.setLayoutProperty('country-boundaries', 'visibility', 'none');
      }
    });

    regmap = new mapboxgl.Map({
      container: "regmap",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 7.7,
      center: radarCoords
    });

    regmap.on("style.load", () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        regmap.setLayoutProperty('background', 'visibility', 'visible');//ocean
        regmap.setLayoutProperty('hawaii local', 'visibility', 'visible');//alaska mercator
        regmap.setLayoutProperty('hawaii regional', 'visibility', 'visible');//hawaii lambert
        regmap.setLayoutProperty('alaska', 'visibility', 'visible');//alaska
        regmap.setLayoutProperty('conus merc', 'visibility', 'visible');//conus mercator
        regmap.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        regmap.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'none');//county lines
        regmap.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'none');//state lines
        regmap.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'none');//coastlines
        regmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        regmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'none');//gray roads
        regmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        regmap.setLayoutProperty('place-label', 'visibility', 'none');
        regmap.setLayoutProperty('place-label copy', 'visibility', 'none');
        regmap.setLayoutProperty('airport-label', 'visibility', 'none');
        regmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        regmap.setLayoutProperty('country-boundaries', 'visibility', 'none');
      }
    });

    regoutlines = new mapboxgl.Map({
      container: "regoutlines",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 7.7,
      center: radarCoords
    });
    regoutlines.on('style.load', () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        regoutlines.setLayoutProperty('background', 'visibility', 'none');//ocean
        regoutlines.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        regoutlines.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        regoutlines.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        regoutlines.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        regoutlines.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        regoutlines.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'visible');//county lines
        regoutlines.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'visible');//state lines
        regoutlines.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'visible');//coastlines
        regoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'visible');//black roads
        regoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'visible');//gray roads
        regoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        regoutlines.setLayoutProperty('place-label', 'visibility', 'none');
        regoutlines.setLayoutProperty('place-label copy', 'visibility', 'none');
        regoutlines.setLayoutProperty('airport-label', 'visibility', 'none');
        regoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        regoutlines.setLayoutProperty('country-boundaries', 'visibility', 'visible');

        regoutlines.setPaintProperty('i2-coastlines-conus-ak-hi-06wtga', "line-width", 3)
        regoutlines.setPaintProperty('i2-county-lines-conus-ak-hi-81h5x4', "line-width", 3)
        regoutlines.setPaintProperty('cb-2019-us-state-20m-nocoast-7m1rrd', "line-width", 7)
        regoutlines.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3', "line-width", 16)
        regoutlines.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', "line-width", 6)
      }
    })

    regoutlinestrans = new mapboxgl.Map({
      container: "regoutlinestrans",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 7.7,
      center: radarCoords
    });
    regoutlinestrans.on('style.load', () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        regoutlinestrans.setLayoutProperty('background', 'visibility', 'none');//ocean
        regoutlinestrans.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        regoutlinestrans.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        regoutlinestrans.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        regoutlinestrans.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        regoutlinestrans.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        regoutlinestrans.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'visible');//county lines
        regoutlinestrans.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'visible');//state lines
        regoutlinestrans.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'visible');//coastlines
        regoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        regoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'visible');//gray roads
        regoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        regoutlinestrans.setLayoutProperty('place-label', 'visibility', 'none');
        regoutlinestrans.setLayoutProperty('place-label copy', 'visibility', 'none');
        regoutlinestrans.setLayoutProperty('airport-label', 'visibility', 'none');
        regoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        regoutlinestrans.setLayoutProperty('country-boundaries', 'visibility', 'visible');

        regoutlinestrans.setPaintProperty('i2-coastlines-conus-ak-hi-06wtga', "line-width", 3)
        regoutlinestrans.setPaintProperty('i2-county-lines-conus-ak-hi-81h5x4', "line-width", 3)
        regoutlinestrans.setPaintProperty('cb-2019-us-state-20m-nocoast-7m1rrd', "line-width", 7)
        regoutlinestrans.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', "line-width", 6)
      }
    })

    //now the same for local
    locradar = new mapboxgl.Map({
      container: "locradar",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 8.65,
      center: radarCoords
    });

    locradar.on("style.load", () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        locradar.setLayoutProperty('background', 'visibility', 'none');//ocean
        locradar.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        locradar.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        locradar.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        locradar.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        locradar.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        locradar.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'none');//county lines
        locradar.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'none');//state lines
        locradar.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'none');//coastlines
        locradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        locradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'none');//gray roads
        locradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        locradar.setLayoutProperty('place-label', 'visibility', 'none');
        locradar.setLayoutProperty('place-label copy', 'visibility', 'none');
        locradar.setLayoutProperty('airport-label', 'visibility', 'none');
        locradar.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        locradar.setLayoutProperty('country-boundaries', 'visibility', 'none');
      }
    });

    locmap = new mapboxgl.Map({
      container: "locmap",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 8.65,
      center: radarCoords
    });

    locmap.on("style.load", () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        locmap.setLayoutProperty('background', 'visibility', 'visible');//ocean
        locmap.setLayoutProperty('hawaii local', 'visibility', 'visible');//alaska mercator
        locmap.setLayoutProperty('hawaii regional', 'visibility', 'visible');//hawaii lambert
        locmap.setLayoutProperty('alaska', 'visibility', 'visible');//alaska
        locmap.setLayoutProperty('conus merc', 'visibility', 'visible');//conus mercator
        locmap.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        locmap.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'none');//county lines
        locmap.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'none');//state lines
        locmap.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'none');//coastlines
        locmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        locmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'none');//gray roads
        locmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        locmap.setLayoutProperty('place-label', 'visibility', 'none');
        locmap.setLayoutProperty('place-label copy', 'visibility', 'none');
        locmap.setLayoutProperty('airport-label', 'visibility', 'none');
        locmap.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        locmap.setLayoutProperty('country-boundaries', 'visibility', 'none');
      }
    });

    locoutlines = new mapboxgl.Map({
      container: "locoutlines",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 8.65,
      center: radarCoords
    });
    locoutlines.on('style.load', () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        locoutlines.setLayoutProperty('background', 'visibility', 'none');//ocean
        locoutlines.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        locoutlines.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        locoutlines.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        locoutlines.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        locoutlines.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        locoutlines.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'visible');//county lines
        locoutlines.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'visible');//state lines
        locoutlines.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'visible');//coastlines
        locoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'visible');//black roads
        locoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'visible');//gray roads
        locoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        locoutlines.setLayoutProperty('place-label', 'visibility', 'none');
        locoutlines.setLayoutProperty('place-label copy', 'visibility', 'none');
        locoutlines.setLayoutProperty('airport-label', 'visibility', 'none');
        locoutlines.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        locoutlines.setLayoutProperty('country-boundaries', 'visibility', 'visible');

        locoutlines.setPaintProperty('i2-coastlines-conus-ak-hi-06wtga', "line-width", 3)
        locoutlines.setPaintProperty('i2-county-lines-conus-ak-hi-81h5x4', "line-width", 3)
        locoutlines.setPaintProperty('cb-2019-us-state-20m-nocoast-7m1rrd', "line-width", 7)
        locoutlines.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3', "line-width", 16)
        locoutlines.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', "line-width", 6)
      }
    })

    locoutlinestrans = new mapboxgl.Map({
      container: "locoutlinestrans",
      projection: "mercator",
      interactive: false,
      trackResize: false, // Authored-size canvas; the outer TV frame scales with the window.
      fadeDuration: 0,
      style: mapStyle,
      zoom: 8.65,
      center: radarCoords
    });
    locoutlinestrans.on('style.load', () => {
      if(mapStyle == "mapbox://styles/colster/cmiccqynn00as01s4bt6501il"){
        locoutlinestrans.setLayoutProperty('background', 'visibility', 'none');//ocean
        locoutlinestrans.setLayoutProperty('hawaii local', 'visibility', 'none');//alaska mercator
        locoutlinestrans.setLayoutProperty('hawaii regional', 'visibility', 'none');//hawaii lambert
        locoutlinestrans.setLayoutProperty('alaska', 'visibility', 'none');//alaska
        locoutlinestrans.setLayoutProperty('conus merc', 'visibility', 'none');//conus mercator
        locoutlinestrans.setLayoutProperty('conus sat', 'visibility', 'none');//conus lambert
        locoutlinestrans.setLayoutProperty('i2-county-lines-conus-ak-hi-81h5x4', 'visibility', 'visible');//county lines
        locoutlinestrans.setLayoutProperty('cb-2019-us-state-20m-nocoast-7m1rrd', 'visibility', 'visible');//state lines
        locoutlinestrans.setLayoutProperty('i2-coastlines-conus-ak-hi-06wtga', 'visibility', 'visible');//coastlines
        locoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3', 'visibility', 'none');//black roads
        locoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', 'visibility', 'visible');//gray roads
        locoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (2)', 'visibility', 'none');
        locoutlinestrans.setLayoutProperty('place-label', 'visibility', 'none');
        locoutlinestrans.setLayoutProperty('place-label copy', 'visibility', 'none');
        locoutlinestrans.setLayoutProperty('airport-label', 'visibility', 'none');
        locoutlinestrans.setLayoutProperty('i2-road-vectors-conus-ak-hi-4r25d3 (4)', 'visibility', 'none');
        locoutlinestrans.setLayoutProperty('country-boundaries', 'visibility', 'visible');

        locoutlinestrans.setPaintProperty('i2-coastlines-conus-ak-hi-06wtga', "line-width", 3)
        locoutlinestrans.setPaintProperty('i2-county-lines-conus-ak-hi-81h5x4', "line-width", 3)
        locoutlinestrans.setPaintProperty('cb-2019-us-state-20m-nocoast-7m1rrd', "line-width", 7)
        locoutlinestrans.setPaintProperty('i2-road-vectors-conus-ak-hi-4r25d3 copy', "line-width", 6)
      }
    })

    //one map for radsat since no drop shadow
    // radarsat = new mapboxgl.Map({
    //   container: "radarsat",
    //   projection: "mercator",
    //   style: {
    //     version: 8,
    //     sources: {
    //       "raster-tiles": {
    //         type: "raster",
    //         tiles: [
    //           "https://api.mapbox.com/styles/v1/goldbblazez/ckgc8lzdz4lzh19qt7q9wbbr9/tiles/{z}/{x}/{y}?access_token=" + map_key
    //         ],
    //         tileSize: 512,
    //       },
    //     },
    //     layers: [
    //       {
    //         id: "basemap",
    //         type: "raster",
    //         source: "raster-tiles",
    //         layout: { visibility: "visible" },
    //         minzoom: 0,
    //         maxzoom: 22,
    //         paint: {
    //           "raster-opacity": 0,
    //         },
    //       },
    //     ],
    //   },
    //   zoom: 4.5,
    //   center: radarCoords
    // });

    // radarsat.on("style.load", () => {
    //   radarsat.setFog({});
    // });
  } finally {
    for (const [element, display, visibility] of styles) {
      element.style.display = display;
      element.style.visibility = visibility;
    }
  }
  // No delayed show/hide: preloading must never interfere with slide ownership.
  void preloadRadars();
}

// Per-map loading state, but only one playback loop (the on-air radar).
const radarStates = new WeakMap();
let activeRadar = null;
let radarTimelineMap = null;
const RADAR_FRAME_MS = 1000 / 12;
const RADAR_END_HOLD_MS = 1000;

function radarState(map) {
  if (!radarStates.has(map)) {
    const state = { timestamps: [], failed: new Set(), current: null, initializing: null, removed: false };
    map.on('error', event => {
      if (event.sourceId?.startsWith('radar_')) state.failed.add(event.sourceId);
    });
    // Update after a GL paint, not on an independent clock. During a handoff
    // only the map actually on air may move the shared history indicator.
    map.on('render', () => updateRadarTimeline(map));
    map.on('remove', () => {
      state.removed = true;
      stopRadar(map);
      if (radarTimelineMap === map) setRadarTimelineMap(null);
    });
    radarStates.set(map, state);
  }
  return radarStates.get(map);
}

// The scale is a real three-hour window ending at the latest provider frame,
// not a percentage of whichever frames happened to finish loading. A partial
// history therefore starts at its actual age instead of falsely claiming -3h.
function radarHistoryPosition(timestamps, current) {
  const valid = (timestamps || []).filter(Number.isFinite);
  if (!valid.length || !Number.isFinite(current)) return null;
  const ageSeconds = Math.max(0, Math.max(...valid) - current);
  return { ageSeconds, progress: Math.max(0, 1 - ageSeconds / 10800) };
}

function setRadarTimelineMap(map) {
  radarTimelineMap = map;
  updateRadarTimeline(map);
}

function updateRadarTimeline(map) {
  if (map !== radarTimelineMap) return;
  const timeline = document.querySelector('.radar-timeline');
  if (!timeline) return;
  const state = map ? radarState(map) : null;
  const position = state ? radarHistoryPosition(state.timestamps, state.current) : null;
  const marker = timeline.querySelector('.radar-time-marker');
  if (!position) {
    marker.hidden = true;
    timeline.removeAttribute('data-frame');
    timeline.removeAttribute('data-age-seconds');
    timeline.setAttribute('aria-label', 'Radar history: waiting for frames');
    return;
  }
  if (timeline.dataset.frame === String(state.current) && timeline.dataset.ageSeconds === String(position.ageSeconds)) return;
  marker.hidden = false;
  timeline.style.setProperty('--radar-progress', String(position.progress));
  timeline.dataset.frame = state.current;
  timeline.dataset.ageSeconds = position.ageSeconds;
  const minutes = Math.round(position.ageSeconds / 60);
  timeline.setAttribute('aria-label', minutes === 0 ? 'Radar history: latest frame' :
    `Radar history: ${Math.floor(minutes / 60)} hours ${minutes % 60} minutes before latest frame`);
}

function waitForRadarStyle(map) {
  if (map.isStyleLoaded()) return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = ready => {
      clearTimeout(timer);
      map.off('style.load', loaded);
      map.off('remove', removed);
      resolve(ready);
    };
    const loaded = () => finish(true), removed = () => finish(false);
    const timer = setTimeout(() => finish(false), 15000);
    map.on('style.load', loaded);
    map.on('remove', removed);
  });
}

async function fetchRadarTimestamps(map, frameCount) {
  const mapType = map === radarsat ? "satrad" : "twcRadarMosaic";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `https://api.weather.com/v3/TileServer/series/productSet/PPAcore?filter=${mapType}&apiKey=${api_key}`,
      { signal: controller.signal }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const series = data.seriesInfo?.[mapType]?.series || [];
    return [...new Set(series.map(item => Number(item.ts)).filter(Number.isFinite))]
      .sort((a, b) => a - b).slice(-frameCount);
  } catch (error) {
    console.warn("Radar timestamps unavailable; retaining any loaded frames.");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function addRadarLayers(map, timestamps) {
  radarState(map);
  for (const timestamp of timestamps) {
    const sourceId = `radar_${timestamp}`;
    const layerId = `radarlayer_${timestamp}`;
    const mapType = map === radarsat ? "satrad" : "twcRadarMosaic";
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "raster",
        tiles: [
          `https://api.weather.com/v3/TileServer/tile/${mapType}?ts=${timestamp}&xyz={x}:{y}:{z}&apiKey=${api_key}`,
        ],
        tileSize: 512,
        minzoom: 5,
        maxzoom: 12,
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        // visibility:none prevents tile loading. Keep sources active and cached,
        // using opacity to select the on-air frame instead of rebuilding layer layout.
        layout: { visibility: "visible" },
        paint: {
          "raster-opacity": 0,
          "raster-opacity-transition": { duration: 0, delay: 0 },
          "raster-fade-duration": 0,
          "raster-brightness-max": 0.9,
        },
      });
    }
  }
}

function radarFrameReady(map, timestamp) {
  const source = `radar_${timestamp}`;
  try {
    return !radarState(map).failed.has(source) && Boolean(map.getLayer(`radarlayer_${timestamp}`)) &&
      map.isSourceLoaded(source);
  } catch (error) {
    return false; // Style/source can disappear during teardown.
  }
}

function animateRadar(map, timestamps) {
  stopRadar();
  const state = radarState(map);
  if (timestamps) state.timestamps = timestamps;
  const playback = { map, due: 0 };
  activeRadar = playback;

  const tick = now => {
    if (activeRadar !== playback) return;
    // A throttled/background tab must never burst through a backlog of frames.
    // Allow sub-millisecond RAF timestamp rounding at the 12 fps boundary.
    if (!document.hidden && now + 0.5 >= playback.due) {
      const ready = state.timestamps.filter(ts => radarFrameReady(map, ts));
      if (ready.length) {
        const currentIndex = ready.indexOf(state.current);
        const next = ready[(currentIndex + 1) % ready.length];
        if (next !== state.current) {
          // Both paint changes land in the same render; never blank the old
          // frame to reveal a source whose visible tiles are still loading.
          map.setPaintProperty(`radarlayer_${next}`, 'raster-opacity', 1);
          if (state.current !== null && map.getLayer(`radarlayer_${state.current}`)) {
            map.setPaintProperty(`radarlayer_${state.current}`, 'raster-opacity', 0);
          }
          state.current = next;
        }
        weatherInfo.radarUnavailable = false;
        playback.due = now + (next === ready[ready.length - 1] ? RADAR_END_HOLD_MS : RADAR_FRAME_MS);
      } else {
        // Slow/erroring tiles cannot clear the previous complete frame.
        weatherInfo.radarUnavailable = state.current === null;
        playback.due = now + RADAR_FRAME_MS;
      }
    }
    radarAnimation = requestAnimationFrame(tick);
  };
  radarAnimation = requestAnimationFrame(tick);
}

function cleanupOldRadarLayers(map, timestamps) {
  const state = radarState(map);
  for (const layer of map.getStyle().layers.filter(layer => layer.id.startsWith('radarlayer_'))) {
    const timestamp = Number(layer.id.slice('radarlayer_'.length));
    // Preserve the displayed frame until a replacement is ready.
    if (!timestamps.includes(timestamp) && timestamp !== state.current) {
      map.removeLayer(layer.id);
      map.removeSource(layer.source);
      state.failed.delete(layer.source);
    }
  }
}

async function initializeRadar(map) {
  const state = radarState(map);
  if (state.removed) return;
  if (state.initializing) return state.initializing;
  state.initializing = (async () => {
    if (!await waitForRadarStyle(map)) return;
    const timestamps = await fetchRadarTimestamps(map, 36);
    if (state.removed || !timestamps.length) return; // Don't discard useful data on a transient failure.
    await addRadarLayers(map, timestamps);
    state.timestamps = timestamps;
    if (map === locradar) loctimestamps = timestamps;
    else if (map === regradar) regtimestamps = timestamps;
    cleanupOldRadarLayers(map, timestamps);
  })().catch(() => {
    console.warn('Radar preload unavailable; playback will retry on the next slide.');
  }).finally(() => { state.initializing = null; });
  return state.initializing;
}

function startRadar(map) {
  const state = radarState(map);
  // Slides resize their map group before starting. Avoid a second resize after
  // frame selection, which used to invalidate freshly requested viewport tiles.
  if (!state.timestamps.length) void initializeRadar(map);
  animateRadar(map);
}

function stopRadar(map) {
  if (map && activeRadar?.map !== map) return;
  activeRadar = null;
  if (radarAnimation !== undefined) cancelAnimationFrame(radarAnimation);
  radarAnimation = undefined;
  // Leave the last complete frame cached, including when its slide is hidden.
}

function addRadarCities(){
  $(".reg-cities").empty();
  $(".reg-cities-trans").empty();
  $(".loc-cities").empty();
  $(".loc-cities-trans").empty();
  for(let i = 0; i < locationConfig.radarCities.regional.length; i++){
    $(".reg-cities").append(`
      <div class="radar-city ${numToWord(i)}" style="top: ${locationConfig.radarCities.regional[i].dotTopPos}px; left: ${locationConfig.radarCities.regional[i].dotLeftPos}px;">
        <div class="dot"></div>
        <div class="city-name" style="margin-top: ${locationConfig.radarCities.regional[i].nameTopMargin}px; margin-left: ${locationConfig.radarCities.regional[i].nameLeftMargin}px;">${locationConfig.radarCities.regional[i].locationName}</div>
      </div>`)
    $(".reg-cities-trans").append(`
      <div class="radar-city ${numToWord(i)}" style="top: ${locationConfig.radarCities.regional[i].dotTopPos}px; left: ${locationConfig.radarCities.regional[i].dotLeftPos}px;">
        <div class="dot-trans"></div>
        <div class="dot-outline"></div>
        <div class="city-name-trans" style="margin-top: ${locationConfig.radarCities.regional[i].nameTopMargin}px; margin-left: ${locationConfig.radarCities.regional[i].nameLeftMargin}px;">${locationConfig.radarCities.regional[i].locationName}</div>
      </div>`)
  }
  for(let i = 0; i < locationConfig.radarCities.local.length; i++){
    $(".loc-cities").append(`
      <div class="radar-city ${numToWord(i)}" style="top: ${locationConfig.radarCities.local[i].dotTopPos}px; left: ${locationConfig.radarCities.local[i].dotLeftPos}px;">
        <div class="dot"></div>
        <div class="city-name" style="margin-top: ${locationConfig.radarCities.local[i].nameTopMargin}px; margin-left: ${locationConfig.radarCities.local[i].nameLeftMargin}px;">${locationConfig.radarCities.local[i].locationName}</div>
      </div>`)
    $(".loc-cities-trans").append(`
      <div class="radar-city ${numToWord(i)}" style="top: ${locationConfig.radarCities.local[i].dotTopPos}px; left: ${locationConfig.radarCities.local[i].dotLeftPos}px;">
        <div class="dot-trans"></div>
        <div class="dot-outline"></div>
        <div class="city-name-trans" style="margin-top: ${locationConfig.radarCities.local[i].nameTopMargin}px; margin-left: ${locationConfig.radarCities.local[i].nameLeftMargin}px;">${locationConfig.radarCities.local[i].locationName}</div>
      </div>`)
  }
}

async function preloadRadars() {
  // The fixed-size canvases are initialized offscreen by createMaps. Loading
  // their styles/tiles needs no fadeIn/fadeOut and cannot hide a live slide.
  await Promise.all([initializeRadar(regradar), initializeRadar(locradar)]);
}
