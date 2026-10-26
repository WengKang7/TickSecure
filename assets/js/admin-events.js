(() => {
    const el = id => document.getElementById(id);
    const body = el('events-table-body');
    if (!body) return;
    const buttons = [...document.querySelectorAll('[data-event-filter]')];
    const submittedStatuses = ['PENDING_REVIEW', 'PUBLISHED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CANCELLED'];
    const tones = { PENDING_REVIEW: 'warning', PUBLISHED: 'success', APPROVED: 'info', REJECTED: 'error', SUSPENDED: 'error', CANCELLED: 'error' };
    let events = [], view = 'pending', initialized = false, loading = false, failed = false;
    const submittedAt = event => event.submittedAt || (Array.isArray(event.statusHistory) ? event.statusHistory : [])
        .filter(entry => entry?.to === 'PENDING_REVIEW' && entry.timestamp)
        .map(entry => entry.timestamp).sort().at(-1) || '';
    const time = event => Date.parse(submittedAt(event) || event.createdAt) || 0;
    const formatDate = value => {
        const date = new Date(value || '');
        return Number.isNaN(date.valueOf()) ? 'Not recorded' : new Intl.DateTimeFormat('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur'
        }).format(date);
    };
    function node(tag, text, className = '') {
        const element = document.createElement(tag);
        element.textContent = text;
        element.className = className;
        return element;
    }
    function message(text) {
        body.replaceChildren();
        const row = document.createElement('tr'), cell = node('td', text, 'text-center secondary');
        cell.colSpan = 7;
        row.appendChild(cell);
        body.appendChild(row);
    }
    function render() {
        if (loading) { message('Loading submitted events...'); return; }
        if (failed) {
            message('Unable to load submitted events. Use Refresh to try again.');
            el('events-count').textContent = 'Events could not be loaded';
            return;
        }
        const search = el('events-search').value.trim().toLowerCase();
        const rows = events.filter(event => {
            const matchesView = view === 'all' || (view === 'pending' && event.status === 'PENDING_REVIEW')
                || (view === 'suspended' && event.status === 'SUSPENDED')
                || (view === 'cancelled' && event.status === 'CANCELLED')
                || (view === 'history' && event.status !== 'PENDING_REVIEW');
            return matchesView && (!search || [event.name, event.organizerName, event.venueName].join(' ').toLowerCase().includes(search));
        });
        rows.sort((a, b) => (el('events-sort').value === 'pending'
            ? Number(b.status === 'PENDING_REVIEW') - Number(a.status === 'PENDING_REVIEW') : 0)
            || time(b) - time(a) || String(a.name || '').localeCompare(String(b.name || '')));
        el('events-count').textContent = `${rows.length} ${rows.length === 1 ? 'event' : 'events'} in this view`;
        body.replaceChildren();
        if (!rows.length) {
            message(search ? 'No events match your search in this view.' : view === 'pending' ? 'No events awaiting review.' : 'No submitted events in this view.');
            return;
        }
        for (const event of rows) {
            const row = document.createElement('tr');
            [event.name || 'Untitled event', event.organizerName || 'Not provided', event.venueName || 'Not provided', formatDate(event.date), formatDate(submittedAt(event))]
                .forEach((value, index) => row.appendChild(node('td', value, index === 0 ? 'cell-title' : '')));
            const statusCell = document.createElement('td');
            statusCell.appendChild(node('span', event.status.replaceAll('_', ' '), `ts-chip ts-chip-${tones[event.status]}`));
            const actionCell = document.createElement('td');
            const link = node('a', event.status === 'PENDING_REVIEW' ? 'Review' : 'View Details', 'ts-btn ts-btn-primary ts-btn-sm');
            link.href = 'event-review.php?id=' + encodeURIComponent(event.id);
            actionCell.appendChild(link);
            row.append(statusCell, actionCell);
            body.appendChild(row);
        }
    }
    async function load() {
        if (loading || window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return;
        loading = true;
        failed = false;
        el('events-refresh').disabled = true;
        el('events-count').textContent = 'Loading submitted events...';
        render();
        try {
            // The service query excludes drafts; keep the same boundary in the UI.
            events = (await window.tsEvents.getAdminEvents()).filter(event => submittedStatuses.includes(event.status));
        } catch {
            failed = true;
            events = [];
        } finally {
            loading = false;
            el('events-refresh').disabled = false;
            render();
        }
    }
    buttons.forEach(button => button.addEventListener('click', () => {
        view = button.dataset.eventFilter;
        buttons.forEach(item => {
            const selected = item === button;
            item.classList.toggle('active', selected);
            item.setAttribute('aria-pressed', String(selected));
        });
        render();
    }));
    el('events-search').addEventListener('input', render);
    el('events-sort').addEventListener('change', render);
    el('events-refresh').addEventListener('click', load);
    window.addEventListener('pageshow', event => { if (event.persisted && initialized) load(); });
    function ready() {
        if (initialized || window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return;
        initialized = true;
        return load();
    }
    window.addEventListener('ts-auth-ready', ready);
    ready();
})();
