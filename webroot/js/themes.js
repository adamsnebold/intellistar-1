// Keep presentation changes separate from weather requests and slide scheduling.
// Shared with the entry page so static hosts cannot mix old CSS with new markup.
const themeAssetRevision = document.querySelector('meta[name="asset-revision"]')?.content || 'mapbox-runtime-20261013-4';
const graphicsThemes = Object.freeze({
    2005: { label: '2005-2006', stylesheet: '2005-2006', icons: '2005-2006', color: '#e0e6e8', aspect: 4 / 3 },
    // Same 4:3 TV frame and icon set as 2005-2006; its own slides and sheet live in regional-2005.js.
    '2005-regional': { label: '2005 Regional', base: '2005-2006', stylesheet: '2005-regional', icons: '2007', color: '#e0e6e8', aspect: 4 / 3 },
    2007: { label: '2007', stylesheet: '2007', icons: '2007', color: '#304976', aspect: 3 / 2 },
    2008: { label: '2008', stylesheet: '2008', icons: '2007', color: '#171717', aspect: 3 / 2 },
    2009: { label: '2009', stylesheet: '2009', icons: '2007', color: '#171717', aspect: 3 / 2 },
    2010: { label: '2010', stylesheet: '2009', icons: '2010', color: '#171717', aspect: 3 / 2 }
});
let themeRequest = 0;
let activeGraphicsPackage;

function versionsChanger(value) {
    const version = value === '2005-2006' ? 2005 : value === '2005-regional' ? '2005-regional' : Number(value);
    const theme = graphicsThemes[version];
    if (!theme) return Promise.resolve(false);
    const request = ++themeRequest;
    if (activeGraphicsPackage === version) {
        $('.versionstext').text(`Version: ${theme.label}`);
        return Promise.resolve(true);
    }

    // The old sheet remains active until the new sheet (including imports) loads.
    // A request token prevents rapid clicks from applying an obsolete theme.
    return new Promise(resolve => {
        const sheet = document.createElement('link');
        sheet.rel = 'stylesheet';
        sheet.media = 'not all';
        sheet.href = `css/intellistar-32-${theme.stylesheet}.css?v=${encodeURIComponent(themeAssetRevision)}`;
        sheet.onload = () => {
            if (request !== themeRequest) {
                sheet.remove();
                resolve(false);
                return;
            }
            const oldSheet = document.getElementById('theme-styles');
            const previous = activeGraphicsPackage;
            appearanceSettings.graphicsPackage = version;
            appearanceSettings.iconSet = theme.icons;
            activeGraphicsPackage = version;
            // The regional package reuses the 2005-2006 base rules; data-package scopes its own.
            document.documentElement.dataset.theme = theme.base || theme.label;
            document.documentElement.dataset.package = String(version);
            // Keep exactly one title active even before styles finish painting.
            const retroTitles = version === 2005 || version === '2005-regional';
            document.querySelectorAll('.theme-title-default').forEach(title => {
                title.hidden = retroTitles;
            });
            document.querySelectorAll('.theme-title-retro').forEach(title => {
                title.hidden = !retroTitles;
            });
            sheet.media = 'all';
            if (oldSheet) oldSheet.remove();
            sheet.id = 'theme-styles';
            $('.changecolor').css('color', theme.color);
            $('.versionstext').text(`Version: ${theme.label}`);
            $('.versionsbutton').attr('aria-pressed', 'false');
            $(`#versions${version}`).attr('aria-pressed', 'true');
            refreshWeatherIcons();
            window.dispatchEvent(new Event('themechange'));
            // Only the LDL presentation loop needs restarting, and only when
            // crossing between the black and blue layouts. Never refetch data.
            if (typeof inSettings !== 'undefined' && !inSettings &&
                previous !== undefined && (previous >= 2009) !== (version >= 2009)) {
                startLoops();
            }
            resolve(true);
        };
        sheet.onerror = () => {
            sheet.remove();
            if (request === themeRequest) {
                console.warn(`Could not load graphics package ${theme.label}; keeping the current theme.`);
                $('.versionstext').text('Theme unavailable');
            }
            resolve(false);
        };
        document.head.appendChild(sheet);
    });
}

const retroIconLoads = new Map();
const iconRenderTokens = new WeakMap();

function loadRetroIcon(path) {
    if (!retroIconLoads.has(path)) {
        retroIconLoads.set(path, new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(path);
            image.onerror = () => resolve(null);
            image.src = path;
        }));
    }
    return retroIconLoads.get(path);
}

function renderWeatherIcon(element) {
    const file = element.dataset.iconFile;
    const size = ['large', 'medium', 'small', 'map', 'stills'].includes(element.dataset.iconSize)
        ? element.dataset.iconSize : 'large';
    const iconSet = appearanceSettings.iconSet;
    const token = {};
    iconRenderTokens.set(element, token);
    const blank = 'images/icons/blank.apng';
    // Existing packs contain only large and stills directories. Smaller display
    // sizes use the large source; retro packs may provide size-specific PNGs.
    const legacySize = size === 'stills' ? 'stills' : 'large';
    const suffix = size === 'stills' ? '.mv.png' : '.webp';
    const fallbackSet = iconSet === '2010' ? '2010' : '2007';
    const fallback = file === 'blank' ? blank : `images/icons/${fallbackSet}/${legacySize}/${file}${suffix}`;
    element.style.backgroundSize = '100% 100%';
    element.style.backgroundImage = `url("${fallback}")`;
    if (iconSet !== '2005-2006' || file === 'blank') return;

    const path = `images/icons/2005-2006/${size}/${file}.png`;
    loadRetroIcon(path).then(loaded => {
        // An earlier request must not overwrite a newer condition or theme.
        if (loaded && iconRenderTokens.get(element) === token && appearanceSettings.iconSet === iconSet) {
            element.style.backgroundImage = `url("${loaded}")`;
        }
    });
}

function refreshWeatherIcons() {
    document.querySelectorAll('[data-icon-file]').forEach(renderWeatherIcon);
}
