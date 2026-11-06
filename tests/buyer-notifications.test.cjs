const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));

class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; this.textContent = ''; }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); }
    replaceChildren(...items) { this.children = items; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, callback) { this.listeners[key] = callback; }
    click() { return this.listeners.click?.(); }
}
function app(options = {}) {
    const names = ['buyer-notifications-link','buyer-notifications-count','notif-container','notification-status','notification-error','btn-refresh-notifications','btn-mark-all'];
    const elements = new Map(names.filter(id => !options.headerOnly || id.startsWith('buyer-')).map(id => [id, new Element()]));
    let records = [{ id: 'n1', type: 'booking_confirmed', message: '<img src=x onerror=alert(1)>', read: false, relatedEntityType: 'booking', relatedEntityId: 'b/1', createdAt: '2026-11-06T10:00:00Z' },
        { id: 'n2', type: 'ticket_transferred', message: 'Ticket received.', read: true }];
    const events = {}, docEvents = {}, writes = [], timers = [];
    let listCalls = 0, countCalls = 0, fail = !!options.fail;
    const window = { location: new URL('http://localhost/ticksecure-ui/buyer/notifications.php'),
        addEventListener: (key, callback) => { events[key] = callback; },
        tsDecision: () => options.decision ? options.decision() : Promise.resolve(options.cancel ? null : {}),
        tsNotifications: {
            getForUser: async () => { listCalls++; if (options.pending) return options.pending(); if (fail) throw Error('Denied'); return structuredClone(records); },
            getUnreadCount: async () => { countCalls++; return records.filter(item => !item.read).length; },
            markRead: async id => { writes.push(['read', id]); records.find(item => item.id === id).read = true; },
            markAllRead: async () => { writes.push(['all']); records.forEach(item => { item.read = true; }); },
            delete: async id => { writes.push(['delete', id]); records = records.filter(item => item.id !== id); }
        } };
    vm.runInNewContext(fs.readFileSync('assets/js/buyer-notifications.js', 'utf8'), { window, document: { hidden: false, getElementById: id => elements.get(id), createElement: tag => new Element(tag), addEventListener: (key, fn) => { docEvents[key] = fn; } },
        setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval() {}, Date, Promise });
    return { elements, writes, events, timers, window, calls: () => ({ listCalls, countCalls }), recover: () => { fail = false; },
        auth: async profile => { window.tsCurrentUser = profile; events['ts-auth-ready']({ detail: profile }); await flush(); },
        action: (text, index = 0) => elements.get('notif-container').children[index].children[1].children.find(button => button.textContent === text).click() };
}

test('buyer inbox loads real service messages safely, links records and updates the unread bell after marking read', async () => {
    const p = app(); await p.auth({ uid: 'buyer-1', role: 'buyer' });
    assert.equal(p.elements.get('buyer-notifications-count').textContent, '1');
    const row = p.elements.get('notif-container').children[0];
    assert.equal(row.children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
    assert.equal(row.children[1].children[0].href, 'booking-detail.php?id=b%2F1');
    await p.action('Mark read');
    assert.deepEqual(p.writes, [['read', 'n1']]);
    assert.equal(p.elements.get('buyer-notifications-count').hidden, true);
    assert.equal(p.elements.get('btn-mark-all').disabled, true);
});
test('mark all and deletion use the existing services; cancelling deletion leaves records intact', async () => {
    const p = app(); await p.auth({ uid: 'buyer-1', role: 'buyer' });
    await p.elements.get('btn-mark-all').click(); assert.deepEqual(p.writes, [['all']]);
    await p.action('Delete'); assert.deepEqual(p.writes[1], ['delete', 'n1']);
    assert.equal(p.elements.get('notif-container').children.length, 1);
    const cancelled = app({ cancel: true }); await cancelled.auth({ uid: 'buyer-1', role: 'buyer' });
    await cancelled.action('Delete'); assert.deepEqual(cancelled.writes, []);
});
test('failed loading is visible and Refresh recovers without a stuck loading state', async () => {
    const p = app({ fail: true }); await p.auth({ uid: 'buyer-1', role: 'buyer' });
    assert.equal(p.elements.get('notification-error').hidden, false);
    assert.equal(p.elements.get('btn-refresh-notifications').disabled, false);
    p.recover(); await p.elements.get('btn-refresh-notifications').click();
    assert.equal(p.elements.get('notification-error').hidden, true);
    assert.equal(p.elements.get('notif-container').children.length, 2);
});
test('header polling only runs for buyers and never loads an inbox on unrelated pages', async () => {
    const p = app({ headerOnly: true }); await p.auth(null); await p.auth({ uid: 'staff', role: 'organizer' });
    assert.equal(p.calls().countCalls, 0);
    await p.auth({ uid: 'buyer-1', role: 'buyer' }); assert.deepEqual(p.calls(), { listCalls: 0, countCalls: 1 });
    await p.auth(null); assert.equal(p.elements.get('buyer-notifications-count').hidden, true);
    await p.timers[0](); assert.equal(p.calls().countCalls, 1);
});
test('late responses after sign-out cannot expose the previous buyer inbox', async () => {
    let respond;
    const p = app({ pending: () => new Promise(resolve => { respond = resolve; }) });
    await p.auth({ uid: 'buyer-1', role: 'buyer' }); await p.auth(null);
    respond([{ id: 'private', message: 'Previous account message' }]); await flush();
    assert.equal(p.elements.get('notif-container').children[0].textContent, 'Sign in to view your notifications.');
    assert.equal(p.elements.get('buyer-notifications-count').hidden, true);
});
test('changing accounts while confirming deletion cannot delete the previous buyer notification', async () => {
    let confirm;
    const p = app({ decision: () => new Promise(resolve => { confirm = resolve; }) });
    await p.auth({ uid: 'buyer-1', role: 'buyer' }); const action = p.action('Delete');
    await p.auth({ uid: 'buyer-2', role: 'buyer' }); confirm({}); await action;
    assert.deepEqual(p.writes, []);
});

function service(options = {}) {
    const source = fs.readFileSync('assets/js/firestore-crud.js', 'utf8');
    const aliases = source.slice(source.indexOf('function withNotificationAliases'), source.indexOf('function withResaleAliases'));
    const definition = source.slice(source.indexOf('export const NotificationService'), source.indexOf('// USER SERVICE')).replace('export const NotificationService', 'globalThis.service');
    const records = Array.from({ length: options.count || 60 }, (_, i) => ({ id: 'n' + i, recipientUid: 'buyer-1', message: 'Message', read: false, createdAt: new Date(1700000000000 + i * 1000).toISOString() }));
    records.push({ id: 'private', recipientUid: 'another-buyer', read: false, createdAt: '2099-01-01' });
    const queries = [], commits = [];
    const context = { db: {}, uid: () => 'buyer-1', iso: () => '', collection: (_, name) => name, doc: (_, name, id) => ({ name, id }),
        where: (field, _, value) => ({ field, value }), orderBy: field => ({ order: field }), limit: value => ({ limit: value }), query: (name, ...conditions) => ({ name, conditions }),
        getDocs: async q => {
            queries.push(q);
            if (options.deny) throw Object.assign(Error('Denied'), { code: 'permission-denied' });
            if (options.noIndex && q.conditions.some(c => c.order)) throw Object.assign(Error('This query requires an index.'), { code: 'failed-precondition' });
            let list = records.filter(item => q.conditions.every(c => !c.field || item[c.field] === c.value));
            if (q.conditions.some(c => c.order)) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            const cap = q.conditions.find(c => c.limit)?.limit; if (cap) list = list.slice(0, cap);
            return { docs: list.map(item => ({ id: item.id, data: () => ({ ...item }) })), size: list.length };
        }, writeBatch: () => { const changes = []; return { update: (ref, data) => changes.push({ ref, data }), commit: async () => { commits.push(changes); } }; }, updateDoc() {}, deleteDoc() {}, addDoc() {} };
    vm.runInNewContext(aliases + definition, context);
    return { api: context.service, queries, commits };
}
test('missing notification index falls back to a recipient-only query and keeps the newest 50', async () => {
    const s = service({ noIndex: true }); const list = await s.api.getForUser();
    assert.equal(list.length, 50); assert.equal(list[0].id, 'n59'); assert.equal(list.at(-1).id, 'n10');
    assert.ok(list.every(item => item.recipientUid === 'buyer-1'));
    assert.equal(s.queries[1].conditions.length, 1);
});
test('permission errors are surfaced without retrying a broader query', async () => {
    const s = service({ deny: true }); await assert.rejects(s.api.getForUser(), { code: 'permission-denied' });
    assert.equal(s.queries.length, 1);
});
test('mark all includes unread notifications beyond the displayed 50 and writes bounded, recipient-only batches', async () => {
    const s = service({ count: 530 }); await s.api.markAllRead();
    assert.deepEqual(s.commits.map(batch => batch.length), [450, 80]);
    assert.ok(s.commits.flat().every(item => item.data.read === true && item.ref.id !== 'private'));
});
