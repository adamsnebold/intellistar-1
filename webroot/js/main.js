$(function () {
    const $main = $('#main');

    function scaleWindow() {
        // Preserve the 1620x1080 authored coordinates (including maps and LDL).
        // Retro output uses the horizontal pixel correction of a 4:3 TV frame.
        const theme = graphicsThemes[appearanceSettings.graphicsPackage];
        const mainWidth = $main.outerWidth();
        const mainHeight = $main.outerHeight();
        const aspect = document.documentElement.dataset.theme === '2005-2006'
            ? 4 / 3 : (theme ? theme.aspect : mainWidth / mainHeight);
        const pixelAspect = aspect / (mainWidth / mainHeight);
        const scale = Math.min(window.innerWidth / (mainWidth * pixelAspect), window.innerHeight / mainHeight);
        $('#main, .container').css({
            transform: `translate(-50%, -50%) scale(${scale * pixelAspect}, ${scale})`
        });
    }

    $(window).on('resize themechange', scaleWindow);
    scaleWindow();
});
