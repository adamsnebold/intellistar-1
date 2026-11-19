# 2005–2006 / Weather Star XL icon pack

This directory is deliberately separate from `../2007` and `../2010`.
**No authentic XL artwork is bundled.** Supply artwork you have permission to use.
Until then, missing retro icons fall back individually to the existing 2007 pack.

## File layout

Export each sprite as a transparent PNG (or animated PNG saved with a `.png`
extension). A sprite atlas must be split into individual condition images first.
Use the exact, case-sensitive `iconFile` names from `webroot/js/extras.js`:

```text
2005-2006/
  large/Sun.png     # forecast, current conditions, and most map icons
  large/Ts.png      # thunderstorms
  large/DPc.png      # partly cloudy
  stills/Sun.png    # black lower-third (LDL) icon
  stills/Ts.png
  medium/...       # optional size-specific icons
  small/...
  map/...
```

Unlike the legacy pack, retro stills use `Name.png`, **not** `Name.mv.png`.
The existing caller determines which size directory is used; most slides,
including regional maps, currently request `large`. Each image scales to the
existing icon box, so preserve transparent padding and the intended proportions.

`renderWeatherIcon()` in `js/themes.js` first displays the corresponding legacy
icon, then replaces it only if the retro PNG loads successfully. Missing assets
are checked once per path per page load, not once per weather update. Reload the
page after adding or replacing files. Missing optional sizes fall back to the
legacy `large` image; missing `stills` fall back to legacy stills. No files in the
2007 or 2010 packs need to be modified.
