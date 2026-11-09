// Read-only display of the exact coordinates saved by the admin venue picker.
(() => {
    const el = id => document.getElementById(id), board = el('event-location-map');
    if (!board) return;
    const preview = new URLSearchParams(window.location.search).get('preview') === '1';
    let map = null;
    function clear(message = 'The organizer has not added a map location for this venue yet.', venue = {}) {
        map?.remove(); map = null;
        board.hidden = true; el('event-location-link').hidden = true;
        el('event-location-link').removeAttribute('href');
        el('event-location-empty').hidden = false; el('event-location-empty').textContent = message;
        el('event-location-status').textContent = message;
        el('event-location-name').textContent = venue.name || 'Venue information';
        el('event-location-address').textContent = venue.address || 'Address to be announced';
    }
    function show(venue) {
        clear(undefined, venue || {});
        const lat = venue?.location?.latitude, lng = venue?.location?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)
            || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        const link = el('event-location-link');
        link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
        link.hidden = preview;
        if (!window.L) {
            el('event-location-status').textContent = el('event-location-empty').textContent = 'The map could not load. You can still read the address or open the location in OpenStreetMap.';
            return;
        }
        try {
            board.hidden = false;
            map = window.L.map(board, {scrollWheelZoom:false, zoomControl:!preview, dragging:!preview,
                touchZoom:!preview, doubleClickZoom:!preview, boxZoom:!preview, keyboard:!preview}).setView([lat, lng], 16);
            const tiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19,
                attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'});
            tiles.on('tileerror', () => { el('event-location-status').textContent = 'Map tiles could not load. Use the address or open the location in OpenStreetMap.'; });
            tiles.addTo(map);
            const marker = window.L.marker([lat, lng], {draggable:false, interactive:!preview, keyboard:!preview, title:venue.name || 'Event venue'}).addTo(map);
            if (!preview) {
                const popup = document.createElement('div'), title = document.createElement('strong'), address = document.createElement('div');
                title.textContent = venue.name || 'Event venue'; address.textContent = venue.address || '';
                popup.append(title, address); marker.bindPopup(popup);
            }
            el('event-location-empty').hidden = true;
            el('event-location-status').textContent = 'Venue pin selected by the administrator.';
        } catch (_) {
            map?.remove(); map = null; board.hidden = true; el('event-location-empty').hidden = false;
            el('event-location-status').textContent = el('event-location-empty').textContent = 'The map is unavailable. Use the venue address or open the location in OpenStreetMap.';
        }
    }
    window.tsEventLocation = {show, clear};
    window.addEventListener('pagehide', () => { map?.remove(); map = null; });
})();
