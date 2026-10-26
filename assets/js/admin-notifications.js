import { auth, db } from './firebase-init.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// These are outstanding tasks, so opening the bell never marks them completed.
export function watchAdminActions(onChange) {
    const sources = [
        { name: 'Events', filters: [where('status', '==', 'PENDING_REVIEW')],
            page: 'event-review.php', label: 'Event awaiting approval', title: data => data.name || 'Untitled event' },
        { name: 'Users', filters: [where('role', '==', 'organizer'), where('status', '==', 'pending')],
            page: 'organizer-detail.php', label: 'Organizer awaiting approval', title: data => data.organizationName || data.fullName || 'Organizer application' },
        { name: 'Complaints', filters: [where('status', '==', 'OPEN')],
            page: 'complaint-detail.php', label: 'Open complaint to review', title: data => data.referenceNumber || data.category || 'New complaint' }
    ];
    const states = sources.map(() => ({ items: [], loaded: false, error: false }));
    let active = true;
    const publish = () => {
        if (!active) return;
        const items = states.flatMap(state => state.items);
        items.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
        onChange({ items, loading: states.some(state => !state.loaded), error: states.some(state => state.error) });
    };
    const subscriptions = sources.map((source, index) => {
        const failed = () => {
            states[index] = { items: [], loaded: true, error: true };
            publish();
        };
        try {
            return onSnapshot(query(collection(db, source.name), ...source.filters), snapshot => {
                states[index] = {
                    loaded: true, error: false,
                    items: snapshot.docs.map(record => {
                        const data = record.data();
                        return { key: source.name + '/' + record.id, id: record.id,
                            title: String(source.title(data)), label: source.label, page: source.page,
                            date: String(data.submittedAt || data.updatedAt || data.createdAt || '') };
                    })
                };
                publish();
            }, failed);
        } catch {
            failed();
            return () => {};
        }
    });
    return () => {
        active = false;
        subscriptions.forEach(unsubscribe => unsubscribe());
    };
}

export function initAdminNotifications() {
    const root = document.getElementById('admin-attention');
    if (!root) return;
    const button = document.getElementById('admin-attention-toggle');
    const dot = document.getElementById('admin-attention-dot');
    const panel = document.getElementById('admin-attention-panel');
    const status = document.getElementById('admin-attention-status');
    const list = document.getElementById('admin-attention-list');
    const close = document.getElementById('admin-attention-close');
    const retry = document.getElementById('admin-attention-retry');
    let unsubscribe = null, currentUid = null, generation = 0, paused = false;

    function setOpen(open, returnFocus = false) {
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) close.focus();
        else if (returnFocus) button.focus();
    }

    function render({ items = [], loading = false, error = false } = {}) {
        // Preserve keyboard focus when a live update replaces the links.
        const focusedKey = document.activeElement?.dataset?.actionKey;
        dot.hidden = items.length === 0;
        button.setAttribute('aria-label', items.length
            ? `Notifications: ${items.length} pending ${items.length === 1 ? 'action' : 'actions'}`
            : error ? 'Notifications: pending actions could not be checked'
                : loading ? 'Notifications: checking pending actions' : 'Notifications: no pending actions');
        status.textContent = error
            ? 'Some pending actions could not be loaded. Try again.'
            : loading ? 'Checking pending actions...'
                : items.length ? `${items.length} ${items.length === 1 ? 'action needs' : 'actions need'} your attention. Select an item to review it.`
                    : 'You are all caught up. No pending actions.';
        retry.hidden = !error;
        list.replaceChildren();
        let restored = false;
        for (const item of items) {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'ts-attention-item';
            link.href = root.dataset.reviewBase + item.page + '?id=' + encodeURIComponent(item.id);
            link.dataset.actionKey = item.key;
            const title = document.createElement('strong');
            title.textContent = item.title;
            const label = document.createElement('span');
            label.textContent = item.label;
            link.append(title, label);
            li.append(link);
            list.append(li);
            if (item.key === focusedKey) { link.focus({ preventScroll: true }); restored = true; }
        }
        if (focusedKey && !restored && !panel.hidden) close.focus({ preventScroll: true });
    }

    function stop() {
        generation++;
        unsubscribe?.();
        unsubscribe = null;
        currentUid = null;
    }

    function synchronize(force = false) {
        const user = window.tsCurrentUser;
        const authorized = !paused && user?.role === 'admin' && user.status === 'active' && user.uid === auth.currentUser?.uid;
        if (!authorized) {
            stop();
            render();
            setOpen(false);
            return;
        }
        if (!force && currentUid === user.uid) return;
        stop();
        currentUid = user.uid;
        render({ loading: true });
        const version = generation;
        unsubscribe = watchAdminActions(state => {
            if (version === generation && currentUid === auth.currentUser?.uid) render(state);
        });
    }

    button.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false, true));
    retry.addEventListener('click', () => { close.focus(); synchronize(true); });
    document.addEventListener('click', event => {
        if (!root.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false, true); }
    });
    window.addEventListener('ts-auth-ready', () => synchronize());
    auth.onAuthStateChanged(() => synchronize());
    window.addEventListener('pagehide', () => { paused = true; synchronize(); });
    window.addEventListener('pageshow', () => { paused = false; synchronize(); });
    synchronize();
}

initAdminNotifications();
