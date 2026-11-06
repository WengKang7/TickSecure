// Buyer inbox and header badge; Firestore permissions remain authoritative.
(() => {
    const el = id => document.getElementById(id);
    const bell = el('buyer-notifications-link'), badge = el('buyer-notifications-count');
    const container = el('notif-container'), status = el('notification-status'), error = el('notification-error');
    const refreshButton = el('btn-refresh-notifications'), markAll = el('btn-mark-all');
    if (!bell && !container) return;
    let owner = null, version = 0, busy = false, loading = false, timer = null, items = [], unread = 0;
    const node = (tag, className, text) => {
        const element = document.createElement(tag); element.className = className || '';
        if (text !== undefined) element.textContent = text;
        return element;
    };
    const current = (v, uid) => version === v && owner === uid && window.tsCurrentUser?.uid === uid && window.tsCurrentUser?.role === 'buyer';
    function setError(message) { if (error) { error.textContent = message || ''; error.hidden = !message; } }
    function setBadge(count) {
        unread = Math.max(0, Number(count) || 0);
        if (badge) { badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : String(unread); }
        if (bell) { bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications'); bell.title = unread ? `${unread} unread notifications` : 'Notifications'; }
        if (markAll) markAll.disabled = busy || loading || !owner || !unread;
    }
    function controls() {
        if (refreshButton) refreshButton.disabled = busy || loading || !owner;
        if (markAll) markAll.disabled = busy || loading || !owner || !unread;
        container?.setAttribute('aria-busy', String(loading || busy));
    }
    function date(value) {
        const result = typeof value?.toDate === 'function' ? value.toDate() : new Date(value || '');
        return Number.isFinite(result.getTime()) ? result.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    }
    function target(item) {
        const id = String(item.relatedEntityId || ''); if (!id) return null;
        const type = String(item.relatedEntityType || '').toLowerCase();
        if (type === 'booking') return `booking-detail.php?id=${encodeURIComponent(id)}`;
        if (type === 'ticket') return `ticket-detail.php?id=${encodeURIComponent(id)}`;
        if (type === 'event') return `../public/event-detail.php?id=${encodeURIComponent(id)}`;
        if (type === 'complaint') return `complaint-detail.php?id=${encodeURIComponent(id)}`;
        if (type === 'resale') return String(item.type || '').includes('purchased') ? 'resale-purchases.php' : 'resale.php';
        return null;
    }
    function render() {
        if (!container) return;
        container.replaceChildren();
        if (!items.length) {
            const empty = node('div', 'ts-notification-empty'); empty.append(node('h2', '', 'You’re all caught up.'), node('p', 'secondary', 'Your booking and ticket updates will appear here.')); container.appendChild(empty);
        }
        items.forEach(item => {
            const article = node('article', 'ts-buyer-notification' + (item.read ? '' : ' is-unread'));
            const copy = node('div', 'ts-notification-copy');
            const title = String(item.type || 'Notification').replace(/_/g, ' ');
            copy.append(node('h2', '', title.charAt(0).toUpperCase() + title.slice(1)), node('p', '', String(item.message || 'You have a new account update.')), node('time', 'secondary', date(item.createdAt)));
            const actions = node('div', 'ts-notification-actions'), href = target(item);
            if (href) { const link = node('a', 'ts-btn ts-btn-secondary ts-btn-sm', 'View details'); link.href = href; actions.appendChild(link); }
            if (!item.read) {
                const read = node('button', 'ts-btn ts-btn-secondary ts-btn-sm', 'Mark read'); read.type = 'button'; read.disabled = busy;
                read.addEventListener('click', () => mutate('read', item)); actions.appendChild(read);
            }
            const remove = node('button', 'ts-btn ts-btn-ghost ts-btn-sm', 'Delete'); remove.type = 'button'; remove.disabled = busy;
            remove.addEventListener('click', () => mutate('delete', item)); actions.appendChild(remove);
            article.append(copy, actions); container.appendChild(article);
        });
        if (status) status.textContent = `${unread} unread · ${items.length} recent notification${items.length === 1 ? '' : 's'}`;
    }
    async function load() {
        if (!owner || loading || busy || document.hidden) return;
        const v = version, uid = owner; loading = true; controls();
        try {
            if (!window.tsNotifications) throw Error('Notifications are still connecting. Please refresh.');
            const results = await Promise.allSettled([container ? window.tsNotifications.getForUser() : Promise.resolve(null), window.tsNotifications.getUnreadCount()]);
            if (!current(v, uid)) return;
            const [list, count] = results;
            if (count.status === 'fulfilled') setBadge(count.value);
            if (container) {
                if (list.status === 'rejected') throw list.reason;
                items = (list.value || []).map(item => ({ ...item, read: item.read ?? item.isRead ?? false }));
                setError(''); render();
                if (count.status === 'rejected') setError('Your messages loaded, but the unread count could not refresh. Try Refresh.');
            }
            if (bell && count.status === 'rejected') bell.title = 'Open notifications. The unread count could not refresh.';
        } catch (_) {
            if (!current(v, uid)) return;
            setError('Could not load your notifications. Check your connection, then select Refresh to try again.');
            if (status) status.textContent = 'Notifications could not refresh.';
            if (container && !items.length) container.replaceChildren(node('p', 'secondary ts-card-pad', 'Your notifications are temporarily unavailable.'));
        } finally { if (current(v, uid)) { loading = false; controls(); } }
    }
    async function mutate(action, item) {
        if (!owner || busy || loading) return;
        const v = version, uid = owner; busy = true; setError(''); controls(); render();
        try {
            if (action === 'delete') {
                if (!await window.tsDecision('deleteNotification', 'Notification', [['Message', item.message || 'Selected notification']])) return;
                if (!current(v, uid)) return;
                await window.tsNotifications.delete(item.id);
            } else if (action === 'read') await window.tsNotifications.markRead(item.id);
            else await window.tsNotifications.markAllRead();
            if (current(v, uid)) { busy = false; await load(); }
        } catch (_) { if (current(v, uid)) setError('Could not update this notification. Please try again.'); }
        finally { if (current(v, uid)) { busy = false; controls(); render(); } }
    }
    function ready(event) {
        const profile = event?.detail !== undefined ? event.detail : window.tsCurrentUser;
        const uid = profile?.role === 'buyer' ? profile.uid : null;
        if (uid && uid === owner) return;
        version++; owner = uid || null; busy = loading = false; items = []; clearInterval(timer); timer = null; setBadge(0); setError(''); controls();
        if (container) container.replaceChildren(node('p', 'secondary ts-card-pad', owner ? 'Loading your notifications...' : 'Sign in to view your notifications.'));
        if (!owner) { if (status) status.textContent = ''; return; }
        load(); timer = setInterval(load, 30000);
    }
    refreshButton?.addEventListener('click', load);
    markAll?.addEventListener('click', () => mutate('all'));
    window.addEventListener('ts-auth-ready', ready);
    window.addEventListener('ts-profile-updated', ready);
    window.addEventListener('load', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    window.addEventListener('pagehide', () => { version++; loading = false; clearInterval(timer); timer = null; });
    window.addEventListener('pageshow', event => { if (event.persisted) { owner = null; ready(); } });
    if (window.tsCurrentUser !== undefined) ready();
})();
