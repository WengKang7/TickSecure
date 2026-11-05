/* Leaflet/OpenStreetMap venue picker. No autocomplete, polling or background geocoding. */
(() => {
    'use strict';
    const el = id => document.getElementById(id);
    const board = el('venue-location-map');
    if (!board) return;
    const query = el('venue-location-query'), search = el('venue-location-search');
    const results = el('venue-location-results'), status = el('venue-location-status');
    const name = el('venue-name'), address = el('venue-address'), clear = el('venue-location-clear');
    const coordinates = el('venue-location-coordinates');
    let map, marker, selected = null, busy = false, version = 0, controller;
    let nameEdits = 0, addressEdits = 0;
    const activeAdmin = () => window.tsCurrentUser?.role === 'admin' && window.tsCurrentUser?.status === 'active';
    const setStatus = message => { status.textContent = message; };
    const hideResults = () => { results.replaceChildren(); results.hidden = true; };
    function setBusy(value) {
        busy = value;
        board.setAttribute('aria-busy', String(value));
        search.disabled = !map || value || !activeAdmin();
    }
    function cancelPending() { ++version; controller?.abort(); }
    function position(lat, lon) {
        const latitude = Number(lat), longitude = Number(lon);
        if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('invalid-location');
        return { latitude, longitude };
    }
    function movePin(location) {
        const point = [location.latitude, location.longitude];
        selected = { ...location };
        if (!marker) {
            marker = window.L.marker(point, { draggable: true, title: 'Venue location. Drag to adjust.', autoPan: true }).addTo(map);
            marker.on('dragstart', () => { cancelPending(); setBusy(true); hideResults(); });
            marker.on('dragend', () => { void lookupPoint(marker.getLatLng()); });
        } else { marker.setLatLng(point); if (!map.hasLayer(marker)) marker.addTo(map); }
        coordinates.textContent = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
        clear.hidden = false;
    }
    function applyDetails(details, edits) {
        if (nameEdits === edits.name) name.value = String(details.name || '').slice(0, 100);
        if (addressEdits === edits.address) address.value = String(details.address || '').slice(0, 500);
    }
    async function lookup(payload) {
        const currentController = new AbortController();
        controller = currentController;
        const signal = currentController.signal;
        const timer = setTimeout(() => currentController.abort(), 25000);
        try {
            const user = window.tsFirebase?.auth?.currentUser;
            if (!user) throw new Error('Sign in again to find a venue location.');
            const token = await user.getIdToken();
            if (signal.aborted || !activeAdmin()) throw new Error('cancelled');
            const response = await fetch(board.dataset.endpoint, { method: 'POST', credentials: 'same-origin', signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'The location service could not complete the lookup.');
            return Array.isArray(body.results) ? body.results : [];
        } finally { clearTimeout(timer); }
    }
    function choosePlace(place) {
        if (!activeAdmin()) return;
        cancelPending();
        const location = position(place.latitude, place.longitude);
        movePin(location);
        applyDetails(place, { name: nameEdits, address: addressEdits });
        map.setView([location.latitude, location.longitude], 17);
        hideResults(); setBusy(false);
        setStatus('Location selected. Review the venue name and address below.');
    }
    async function findPlaces() {
        if (!map || !activeAdmin() || busy) return;
        const text = query.value.trim();
        if (text.length < 3) { setStatus('Enter at least 3 characters to search for a venue or address.'); query.focus(); return; }
        cancelPending(); const request = version;
        hideResults(); setBusy(true); setStatus('Searching for venues…');
        try {
            const places = await lookup({ action: 'search', q: text.slice(0, 200) });
            if (request !== version || !activeAdmin()) return;
            if (!places.length) { setStatus('No locations found. Try a fuller address, including the city, or choose a point on the map.'); return; }
            for (const place of places) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'ts-venue-location-result';
                const title = document.createElement('strong'), detail = document.createElement('span');
                title.textContent = place.name || place.address; detail.textContent = place.address;
                button.append(title, detail); button.addEventListener('click', () => choosePlace(place)); results.appendChild(button);
            }
            results.hidden = false; setStatus('Choose a result to fill in the venue details.');
        } catch (error) {
            if (request === version && activeAdmin()) setStatus(error.name === 'AbortError'
                ? 'The location lookup timed out. Try again or enter the venue details manually.'
                : `${error.message} You can enter the details manually.`);
        } finally { if (request === version) setBusy(false); }
    }
    async function lookupPoint(point) {
        if (!map || !activeAdmin()) return;
        cancelPending(); const request = version, edits = { name: nameEdits, address: addressEdits };
        hideResults(); name.value = ''; address.value = '';
        const location = position(point.lat, point.lng);
        movePin(location); setBusy(true); setStatus('Finding details for this location…');
        try {
            const places = await lookup({ action: 'reverse', lat: location.latitude, lon: location.longitude });
            if (request !== version || !activeAdmin()) return;
            if (!places.length) { setStatus('The pin is selected, but no address was found here. Enter the venue name and address below.'); return; }
            applyDetails(places[0], edits);
            // Keep the exact pin even when the result describes a nearby building or road.
            setStatus('Nearest venue or address filled in. Review the details below.');
        } catch (error) {
            if (request === version && activeAdmin()) setStatus(error.name === 'AbortError'
                ? 'The lookup timed out. The pin is selected; enter the venue details manually or try again.'
                : `${error.message} The pin is selected; enter the venue details manually or try again.`);
        } finally { if (request === version) setBusy(false); }
    }
    function clearSelection() {
        cancelPending(); selected = null;
        if (marker) marker.remove();
        coordinates.textContent = 'No location selected'; clear.hidden = true;
        hideResults(); setBusy(false); setStatus('Pin cleared. Search again, choose a point, or use the details below.');
    }
    function initialize() {
        if (!activeAdmin()) { cancelPending(); setBusy(false); hideResults(); return; }
        if (map) { setBusy(false); return; }
        if (!window.L) {
            setStatus('The map could not load. Check your internet connection or enter the venue details manually.');
            board.textContent = 'Map unavailable. You can still enter the venue details below.';
            board.classList.add('ts-venue-location-empty'); return;
        }
        map = window.L.map(board, { scrollWheelZoom: false }).setView([3.139, 101.6869], 12);
        window.L.tileLayer(board.dataset.tileUrl, { maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(map);
        map.on('click', event => { void lookupPoint(event.latlng); });
        setBusy(false); setStatus('Search for a public venue or click the map to place a pin. No API key or billing is needed.');
    }
    name.addEventListener('input', () => { nameEdits++; }); address.addEventListener('input', () => { addressEdits++; });
    search.addEventListener('click', findPlaces);
    query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void findPlaces(); } });
    clear.addEventListener('click', clearSelection);
    window.tsVenueLocation = { getSelection: () => selected ? { ...selected } : null, isBusy: () => busy };
    search.disabled = true;
    window.addEventListener('ts-auth-ready', initialize); initialize();
})();
