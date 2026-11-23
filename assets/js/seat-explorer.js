/* Presentation-only fullscreen control. It never changes seat or hold state. */
(() => {
    const panel = document.getElementById('picker-explorer');
    const button = document.getElementById('picker-expand');
    if (!panel || !button || !document.fullscreenEnabled || !panel.requestFullscreen) return;
    button.hidden = false;
    const sync = () => {
        const expanded = document.fullscreenElement === panel;
        button.textContent = expanded ? 'Exit expanded view' : 'Expand view';
        button.setAttribute('aria-expanded', String(expanded));
        window.dispatchEvent(new Event('resize'));
    };
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            if (document.fullscreenElement === panel) await document.exitFullscreen();
            else await panel.requestFullscreen();
        } catch (_) {
            // A browser may decline fullscreen; the normal viewer remains usable.
            button.textContent = 'Expand unavailable';
        } finally { button.disabled = false; }
    });
    document.addEventListener('fullscreenchange', () => { sync(); button.focus({ preventScroll:true }); });
})();
