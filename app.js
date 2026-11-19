const express = require('express');
const path = require('path');
// Keep local settings outside the static webroot and never log their values.
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const app = express();
const port = 8080;

// Mapbox GL runs in the browser, so expose only its public (pk.) token.
// Never serialize process.env or send a server-side/secret Mapbox token.
app.get('/runtime-config.js', (req, res) => {
    const token = (process.env.MAPBOX_ACCESS_TOKEN || '').trim();
    const config = { mapboxAccessToken: /^pk\.[A-Za-z0-9._-]+$/.test(token) ? token : '' };
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/javascript').send(`window.INTELLISTAR_CONFIG = ${JSON.stringify(config)};\n`);
});

app.use(express.static(path.join(__dirname, 'webroot'), {
    setHeaders(res, filePath) {
        // HTML, styles, and code must stay in sync during theme updates. Media
        // retains Express's normal caching/revalidation behavior.
        if (/\.(?:html|css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
}));

if (require.main === module) {
    app.listen(port, '0.0.0.0', () => {
        console.log('IntelliSTAR 1 by Mist Weather Media');
        console.log(`Webroot serving on port ${port}`);
    });
}

module.exports = app;
