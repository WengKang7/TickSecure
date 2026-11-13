// A read-only gallery of the current buyer's tickets. No minting or data writes.
(() => {
    const el = id => document.getElementById(id), grid = el('collection-grid');
    if (!grid) return;
    const art = window.tsCollectibleArt, display = window.tsTicketDisplay;
    const filters = [...document.querySelectorAll('[data-collection-filter]')];
    let tickets = [], owner = null, version = 0, loading = false, filter = 'all', timer = null;
    const node = (tag, className, text) => {
        const element = document.createElement(tag); element.className = className || '';
        if (text !== undefined) element.textContent = text;
        return element;
    };
    const current = (v, uid) => version === v && owner === uid && window.tsCurrentUser?.uid === uid && window.tsCurrentUser?.role === 'buyer';
    const setError = message => { el('collection-error').textContent = message || ''; el('collection-error').hidden = !message; };
    function card(ticket) {
        const imageArt = art.artwork(ticket), mint = art.mintState(ticket);
        const link = node('a', 'ts-collectible-card');
        link.href = 'ticket-detail.php?id=' + encodeURIComponent(ticket.id);
        link.setAttribute('aria-label', `${ticket.eventName || 'Event ticket'}, ${ticket.categoryName || 'Ticket'}, seat ${window.tsTicketDisplay.seatLabel(ticket)}. ${mint.label}. View ticket.`);
        const poster = node('div', 'ts-collectible-poster ts-collectible-' + imageArt.key);
        const image = node('img', 'ts-collectible-image');
        if (imageArt.src) image.src = imageArt.src; else image.hidden = true; image.alt = imageArt.name + ' collectible artwork'; image.width = 1122; image.height = 1402; image.loading = 'lazy'; image.decoding = 'async';
        image.addEventListener('error', () => { image.hidden = true; });
        const top = node('div', 'ts-collectible-top');
        top.append(node('span', 'ts-collectible-brand', 'ticksecure®'), node('span', 'ts-collectible-series', ticket.categoryName || 'Event pass'));
        const caption = node('div', 'ts-collectible-caption');
        caption.append(node('span', 'ts-collectible-edition', imageArt.name), node('strong', 'ts-collectible-category', ticket.categoryName || 'Event pass'),
            node('h2', 'ts-collectible-event', ticket.eventName || 'Event ticket'), node('span', 'ts-collectible-date', display.eventDate(ticket, ticket._event)));
        const footer = node('div', 'ts-collectible-footer');
        footer.append(node('span', '', 'KEEP THE MOMENT'), node('span', '', '#' + String(ticket.id).slice(-8).toUpperCase()));
        poster.append(image, top, caption, footer);
        const meta = node('div', 'ts-collectible-meta');
        const mintLabel = node('span', 'ts-collectible-mint' + (mint.minted ? ' is-minted' : ''), mint.label);
        const [label, tone] = display.ticketStatus(ticket.status);
        meta.append(mintLabel, node('span', 'ts-chip ts-chip-' + tone, label));
        const bottom = node('div', 'ts-collectible-bottom');
        bottom.append(node('span', '', 'Seat ' + window.tsTicketDisplay.seatLabel(ticket)), node('span', 'ts-collectible-open', 'View ticket ↗'));
        link.append(poster, meta, bottom);
        return link;
    }
    function render() {
        const search = el('collection-search').value.trim().toLowerCase();
        const filtered = tickets.filter(ticket => {
            const minted = art.mintState(ticket).minted;
            return (filter === 'all' || (filter === 'minted' ? minted : !minted))
                && (!search || [ticket.eventName, ticket.categoryName, ticket.seatId, window.tsTicketDisplay.seatLabel(ticket), ticket.id].some(value => String(value || '').toLowerCase().includes(search)));
        });
        grid.replaceChildren(...filtered.map(card));
        el('collection-total').textContent = String(tickets.length).padStart(2, '0');
        el('collection-minted').textContent = String(tickets.filter(ticket => art.mintState(ticket).minted).length).padStart(2, '0');
        el('collection-events').textContent = String(new Set(tickets.map(ticket => ticket.eventId).filter(Boolean)).size).padStart(2, '0');
        el('collection-status').textContent = `${filtered.length} of ${tickets.length} collectible${tickets.length === 1 ? '' : 's'} · NFT status is shown on each card.`;
        el('collection-empty').hidden = filtered.length > 0;
        el('collection-empty-title').textContent = tickets.length ? 'No matching collectibles.' : 'Your collection starts here.';
        el('collection-empty-copy').textContent = tickets.length ? 'Try another search or choose All tickets.' : 'Tickets you own will appear here with their own collectible artwork.';
        el('collection-browse').hidden = tickets.length > 0;
        filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.collectionFilter === filter)));
    }
    async function load() {
        if (!owner || loading || document.hidden) return;
        const v = version, uid = owner; loading = true; grid.setAttribute('aria-busy', 'true'); el('collection-refresh').disabled = true;
        try {
            const records = await window.tsTickets.getUserTickets();
            if (!current(v, uid)) return;
            const owned = [...new Map(records.filter(ticket => ticket.ownerUid === uid && ticket.id).map(ticket => [ticket.id, ticket])).values()];
            const eventIds = [...new Set(owned.filter(ticket => ticket.eventId).map(ticket => ticket.eventId))];
            const events = new Map(await Promise.all(eventIds.map(async id => {
                try { return [id, await window.tsEvents.getEvent(id)]; } catch (_) { return [id, null]; }
            })));
            if (!current(v, uid)) return;
            tickets = owned.map(ticket => {
                const event = events.get(ticket.eventId);
                return { ...ticket, eventName: ticket.eventName || event?.name || 'Event ticket', _event: event };
            });
            setError(''); render();
        } catch (_) {
            if (!current(v, uid)) return;
            setError('Could not refresh your collection. Please try again.');
            if (!tickets.length) el('collection-status').textContent = 'Your collection could not load.';
        } finally {
            if (current(v, uid)) { loading = false; grid.setAttribute('aria-busy', 'false'); el('collection-refresh').disabled = false; }
        }
    }
    function ready(event) {
        const profile = event?.detail !== undefined ? event.detail : window.tsCurrentUser;
        const uid = profile?.role === 'buyer' ? profile.uid : null;
        if (uid && owner === uid) return;
        version++; owner = uid || null; loading = false; tickets = []; filter = 'all'; clearInterval(timer); timer = null;
        el('collection-search').value = ''; grid.replaceChildren(); setError('');
        ['collection-total','collection-minted','collection-events'].forEach(id => { el(id).textContent = '—'; });
        el('collection-empty').hidden = true;
        el('collection-status').textContent = owner ? 'Loading your collection...' : 'Sign in to view your collection.';
        grid.setAttribute('aria-busy', String(!!owner)); el('collection-refresh').disabled = !owner;
        if (owner) { load(); timer = setInterval(load, 30000); }
    }
    filters.forEach(button => button.addEventListener('click', () => { filter = button.dataset.collectionFilter; render(); }));
    el('collection-search').addEventListener('input', render);
    el('collection-refresh').addEventListener('click', load);
    window.addEventListener('ts-auth-ready', ready); window.addEventListener('ts-profile-updated', ready);
    window.addEventListener('load', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    window.addEventListener('pagehide', () => { version++; loading = false; clearInterval(timer); timer = null; });
    window.addEventListener('pageshow', event => { if (event.persisted) { owner = null; ready(); } });
    if (window.tsCurrentUser !== undefined) ready();
})();
