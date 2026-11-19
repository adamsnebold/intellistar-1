# IntelliStar Simulator 

**IntelliStar Simulator** is a simulated recreation of "Local On The 8s" by The Weather Channel in HTML/CSS/JS, as seen from 2007 to 2008, by ***mist weather media***

Online version: [i1.weatherstar.dev](https://i1.weatherstar.dev)

© Mist Weather Media 2025.

------------

**Special thanks to these talented minds who made this project possible!**

**JensonWX** - Lead Developer  
**Miceoroni** - Developer (Advanced Settings)   
**zachNet** - README

and the rest of the Mist Creative Team for their support!

------------

Need support beyond the scope of this README? Have any questions? Feel free to join our Discord for support!

[***mist weather media*** on Discord](https://discord.gg/hV2w5sZQxz)

------------

Are you a developer? Pull requests are welcome! If you find a bug and fix it yourself, submit one with the fixed code and it may be merged into the main branch!

# Initial Setup

1. Install [Node.js LTS](https://nodejs.org/en/).
2. Acquire a **public Mapbox access token** (`pk.*`). This is required for the radar basemap.
3. Copy `.env.example` to `.env` in the repository root (next to `app.js`).
4. Set `MAPBOX_ACCESS_TOKEN` in `.env` to your public token. `.env` is ignored by Git; do not commit tokens.
5. Run `npm ci` (or `install.bat` / `install.sh`) to install dependencies.
6. Run `npm start` (or `start.bat` / `start.sh`) to serve the app on port **8080**.
7. Open the preview, select your location/theme, and press **Start**. Radar appears in the normal slide rotation.

### Runtime Mapbox configuration

The Express server reads `.env` on startup, then serves a same-origin
`runtime-config.js` before `js/config.js`. Only `MAPBOX_ACCESS_TOKEN` is exposed,
and only if it is a public `pk.*` token. `map_key` supplies both Mapbox GL's vector
maps and the raster fallback URLs. No browser-facing service calls use localhost.
Restart the server and reload the browser after changing `.env`. Environment
variables supplied by the process take precedence over `.env`.

Mapbox **public** tokens are necessarily visible to the browser. For a restricted
token, allow the actual preview origin (`https://8080-<sandbox-id>.e2b.app`) in your
Mapbox token settings. Never use a secret `sk.*` token; the runtime endpoint will
not expose it or any other environment variables. The `.env` file itself is
outside the served webroot.

Use `npm start` for `.env` support. The static-only `http-server` / `dev-server`
commands do not load `.env`; static deployments must supply public configuration
in `webroot/runtime-config.js` themselves.

Mapbox authenticates the basemap, not the Weather.com radar feed. Both services
must be reachable from the browser. A valid token must also have access to the
existing third-party styles/tilesets. If maps return 401/403, check token origin
restrictions and style permissions. This sandbox cannot make outbound requests
to those services, so live API authentication must be verified in the browser.

------------

You're all set. Enjoy!

Many thanks for using our simulator! We hope you like it.

## Graphics packages / 2005–2006 theme

In the configuration overlay, select **2005-2006** alongside the existing
2007, 2008, 2009, and 2010 buttons. To use it on every startup, set
`appearanceSettings.graphicsPackage: 2005` in `webroot/js/config.js` (the string
`"2005-2006"` is also accepted). Selecting a button affects this session only;
location-config downloads still contain location settings, not appearance settings.
The default remains 2010.

The retro package uses a dedicated cloud-textured blue sky with a soft upper-right
sun bloom, translucent cobalt/indigo panels, mixed-case forecast and crawl text,
split light/dark lowercase slide headings, and the black LDL. It is a CSS recreation inspired
by mid-2000s broadcasts, not a pixel-exact replacement of all original artwork.
Source weather text is preserved: names, units, and acronyms are not blindly
lowercased. Later packages retain their existing appearance and uppercase alerts.

### Layout and switching

- `webroot/js/themes.js` defines package metadata and switches stylesheets only
  after a successful load. Rapid selections discard stale load results.
- `webroot/css/intellistar-32-2005-2006.css` reuses the 2007 coordinate layout and
  overrides its panels and typography. Its sky artwork is isolated in
  `webroot/images/themes/2005-2006/sky.jpg`; see that folder’s README for provenance.
  Existing graphics CSS and background artwork are left intact.
- `webroot/js/main.js` keeps the authored **1620×1080** coordinates for slides,
  maps, and overlays. Retro display applies horizontal pixel-aspect correction
  to produce a **4:3 bounding box**, fitted and centered without cropping at any
  viewport size. Other packages retain **3:2** output.
- Switching updates existing icons as well as future weather renders. It does
  not restart weather polling, slide timers, radar maps, or audio. Only crossing
  the black/blue LDL boundary restarts its presentation timers; active alerts are
  retained and normal LDL playback resumes afterward.

### Installing retro icons

Place exported XL condition PNGs under
`webroot/images/icons/2005-2006/large/` and lower-third PNGs under `stills/`.
Use the `iconFile` basenames already defined in `webroot/js/extras.js`, for example
`large/Ts.png` and `stills/Ts.png`. See the
[icon-pack instructions](webroot/images/icons/2005-2006/README.md) for sizes and
naming. **XL sprites are not included**; missing icons safely use the 2007 pack.
Reload after installing artwork. Neither existing icon pack is overwritten.

### Tests

Run `npm ci` and `npm test` (Node.js 18 or newer for the test harness). Tests cover
package selection, rapid switching, stylesheet failure, icon fallback and stale
loads, viewport fitting, and LDL timer/alert continuity without live weather APIs.

### Asset refresh / preview updates

The Express server sends HTML, CSS, and JavaScript with `Cache-Control: no-store`
to prevent a new entry page from being paired with stale theme rules. Entry
scripts/styles and dynamically loaded themes also use an `asset-revision` query
parameter, including the retro sky and its base stylesheet import, so updates
work on static hosts too. When changing these assets, bump the revision in
`index.html` and its asset URLs, the fallback in `themes.js`, and the retro CSS
asset URLs together. Restart `npm start` after server changes, then reload any
already-open simulator tab to pick up the new entry page.

## International regional forecast backgrounds

The **Now / Tonight's / Tomorrow's Forecast** regional map uses the original
bitmap and authored pixel grid for covered contiguous-US locations. For a
foreign country, or coordinates outside longitude **−125…−66** / latitude
**24…50**, it switches to a Mapbox Static Images background. This also covers
Alaska, Hawaii, and territories outside that particular atlas. Country metadata
keeps Canadian/Mexican cities inside the bounding rectangle from being mistaken
for US locations.

- `webroot/js/regional-map.js` owns the boundary check, static camera, image
  lifecycle, and Web Mercator label projection. It reuses the existing public
  `map_key`; no additional token or server-side Mapbox proxy is needed.
- `webroot/css/regional-map.css` affects **only** the international regional map.
  It uses an SVG atlas palette filter: olive land and deep-blue water, preserving
  the source image’s luminance detail. Full city names have wider, wrapping labels
  and collision spacing; administrative boundaries remain emphasized. The custom 2005–2006 stylesheet, sky, panels, titles, weather icons,
  lower third, and live radar styling are unchanged.
- The image uses `mapbox/outdoors-v12`, a flat classic map with place/landmark
  labels, plus an administrative-boundary line layer. This approximates the US
  atlas palette; it does not replace the source geography or remove baked-in
  modern labels. The official, unaltered Mapbox wordmark is displayed separately
  from the filtered image, with readable Mapbox/OpenStreetMap/feedback links
  above the lower third (without a heavy credit-strip background).
- Weather cards use the selected city's and already-discovered nearby cities'
  coordinates, never US-grid offsets. Up to ten nearby candidates (within 350 km)
  are considered; overlapping or offscreen weather cards are omitted instead of
  moving them to incorrect locations. If nearby data is unavailable, the selected
  city still works, while the background supplies surrounding place names.
- Existing manual US layouts are retained. International manual city lists must
  contain `lat`/`lon`; their US pixel offsets are not reused. Background X/Y grid
  controls are disabled for international maps because centering is geographic.
- A single background request is reused between forecast periods. Late responses
  from a previous region are ignored. Missing tokens, image errors, and a 12-second
  load timeout produce a neutral map-unavailable message without stopping forecast
  playback; failed images can retry after a minute. Weather requests keep the
  existing non-blocking refresh behavior.

Reload the preview after updating, select an international location (for example,
London or Tokyo), then run the normal forecast sequence. Live Mapbox Static Images
and weather services must be reachable from your browser; sandbox tests use
controlled responses for deterministic rendering, not a live-provider check.


## Radar playback

Regional and local Doppler retain their existing styles, coordinates, frame count,
approximately 12 fps playback, and a one-second final-frame hold. Both default
radar slots now last eight seconds (local was twelve); custom slide durations
are still honored.
`webroot/js/radar.js` now prepares fixed-size canvases invisibly, waits for style
readiness, and preloads radar sources at zero opacity. Only frames whose viewport
tiles have finished loading are selected; failed frames are skipped and the last
complete image is retained while other tiles load. Opacity changes have no fade,
so precipitation is not blended across different timestamps.

One cancellable `requestAnimationFrame` loop owns playback. Slide exit/switch and
map removal stop it completely; late network responses cannot restart a slide.
Preloading never uses delayed panel show/hide calls. Window resizing scales the
outer TV frame rather than shrinking hidden WebGL canvases to a fallback size.
Outline layers are configured on `style.load`, before the initial map paint.

Run `npm test` for coverage of tile readiness, errors, timing, cancellation,
late responses, style-load deadlines, token wiring, and the existing theme and
regional-map regressions. Chromium/WebGL was also checked with controlled raster
tiles, including delayed frames and hidden-window resizing; this is not a live
weather-provider performance benchmark.


## Slide transitions and solar times

Product changes use clean, synchronized switches rather than full-screen fades
or crossfades. The original inner title/panel animations are retained. Between
regional and local radar, the incoming map is staged invisibly at full size until
it paints a complete frame, then the title and map stack switch together. A
500 ms fallback bounds the wait if tiles fail; this does not extend the radar
slot. Slide-owned callbacks and render listeners are cancelled on handoff and
restart, independently of weather/LDL timers, and map-forecast exit animations
fit inside each configured period rather than extending it.

Sunrise and sunset use the location-local wall-clock fields supplied by the
weather API, including the offset applicable to each event, instead of converting
them to the viewer's computer time zone. The almanac date label likewise follows
the forecast's local date. Missing solar events display an em dash, and repeated
almanac visits replace the previous times instead of appending duplicates.

These changes are covered by `tests/slides-and-solar.test.js`, including Pacific,
UTC, and Tokyo viewer zones, DST/fractional offsets, radar deadlines, repeated
starts, non-fading switches, and cancelled render listeners. A Chromium/WebGL
smoke check with controlled radar tiles also exercises the regional/local and
subsequent product handoffs.


## 2005–2006 radar history strip

Only the retro package shows the reference-inspired monochrome radar banner:
white “regional”/“local” lettering on a translucent black block, black “radar”
lettering on a pale translucent band, and a compact black legend/history strip.
It includes the **Past 3 Hours** caption and **-3 / -2 / -1 / 0** scale with a
purple slanted marker. The 2007 blue banner bitmap is suppressed for this radar
view only; other product titles and the underlying map are unchanged. Styling is
isolated in `webroot/css/radar-timeline.css`; later packages keep their existing
legend and “3 Hour Loop” caption.

The indicator reads the timestamps of the radar frame actually painted by WebGL,
with zero representing the newest provider frame (not necessarily the current
wall-clock time). It moves with playback, holds with the last image during
buffering and the end-of-loop pause, and jumps back when the loop repeats. Missing
frames are not stretched to fill the scale: a shorter available history starts
at its actual age. Regional/local handoffs switch ownership with the displayed
map. There is no separate animation timer or CSS sweep to drift out of sync.

## 2005–2006 current-conditions title

`webroot/css/current-conditions-banner.css` replaces only the retro current-conditions
header's rectangular fills with feathered translucent layers. The shared cloudy sky
remains visible, with an italic white “current,” black “conditions,” a subtle blue
left-hand outline, and a pale wash that fades out above, below, and to the right.
The weather panels, approved radar banner, other product titles, and later packages
are unchanged. No additional image or animation loop is introduced.

## 2005–2006 regional forecast headings

The regional map uses the same translucent monochrome title treatment as the
retro radar: white period lettering on a dark block and black “forecast” on a
pale band. Today, Tonight, Tomorrow, named weekdays, and the Regional Forecast
fallback use the dynamic period supplied by the existing weather data. The Now
observations map uses the same styling while retaining its “Now” label.

`webroot/css/map-forecast-banner.css` is scoped to the 2005–2006 map heading and
suppresses only its old blue banner. It works with both the original US atlas
and international backgrounds. Other headings, city weather, slide timing, and
later packages are unchanged. The title spans retain the original text content
and render provider strings as text rather than HTML.
