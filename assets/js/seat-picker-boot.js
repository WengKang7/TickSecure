// The original canvas renderer remains available when WebGL cannot be loaded.
const script = document.getElementById('seat-picker-boot');
try { await import(new URL(script.dataset.renderer, document.baseURI).href); }
catch (error) { console.warn('Using the compatible seat preview.', error); }
await import(new URL(script.dataset.picker, document.baseURI).href);
