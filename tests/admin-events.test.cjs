const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const records = [
    { id: 'draft', name: 'Private draft', status: 'DRAFT' },
    { id: 'pub&1', name: 'Published show', organizerName: 'Alpha', venueName: 'The Hall', status: 'PUBLISHED', submittedAt: '2026-10-24T10:00:00Z' },
    { id: 'pending', name: 'Pending show', organizerName: 'Beta', venueName: 'Theatre', status: 'PENDING_REVIEW', statusHistory: [{ to: 'PENDING_REVIEW', timestamp: '2026-10-23T10:00:00Z' }] },
    { id: 'suspended', name: 'Suspended show', status: 'SUSPENDED' },
    { id: 'cancelled', name: 'Cancelled show', status: 'CANCELLED' },
    { id: 'rejected', name: 'Rejected show', status: 'REJECTED' },
    { id: 'approved', name: 'Approved show', status: 'APPROVED' },
    { id: 'unknown', name: 'Incomplete draft' }
];

function page(initial = records) {
    class Element {
        constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.value = ''; this.classes = new Set(); }
        appendChild(child) { this.children.push(child); }
        append(...children) { this.children.push(...children); }
        replaceChildren() { this.children = []; }
        setAttribute(name, value) { this.attributes[name] = value; }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        get classList() { return { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) }; }
        click() { return this.listeners.click?.(); }
    }
    const elements = new Map(['events-table-body', 'events-search', 'events-sort', 'events-count', 'events-refresh'].map(id => [id, new Element()]));
    elements.get('events-sort').value = 'pending';
    const tabs = ['pending', 'all', 'suspended', 'cancelled', 'history'].map(value => {
        const element = new Element(); element.dataset.eventFilter = value; return element;
    });
    let data = structuredClone(initial), fail = false, calls = 0;
    const events = {};
    const window = {
        addEventListener: (type, listener) => { events[type] = listener; },
        tsEvents: { getAdminEvents: async () => { calls++; if (fail) throw new Error('Unavailable'); return data; } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/admin-events.js'), 'utf8'), {
        window, document: { getElementById: id => elements.get(id), querySelectorAll: () => tabs, createElement: () => new Element() }, Intl
    });
    return {
        elements, window, events, get calls() { return calls; }, tabs,
        ready: () => { window.tsCurrentUser = { role: 'admin', status: 'active' }; return events['ts-auth-ready'](); },
        tab: name => tabs.find(tab => tab.dataset.eventFilter === name).click(),
        names: () => elements.get('events-table-body').children.filter(row => row.children.length === 7).map(row => row.children[0].textContent),
        rows: () => elements.get('events-table-body').children,
        search: value => { elements.get('events-search').value = value; elements.get('events-search').listeners.input(); },
        sort: value => { elements.get('events-sort').value = value; elements.get('events-sort').listeners.change(); },
        data: value => { data = value; }, fail: value => { fail = value; }
    };
}

test('Pending Review initially contains only awaiting approvals and other statuses say View Details', async () => {
    const p = page();
    await p.ready();
    assert.deepEqual(p.names(), ['Pending show']);
    assert.equal(p.rows()[0].children[6].children[0].textContent, 'Review');
    p.tab('all');
    assert.equal(p.names().length, 6);
    assert.ok(!p.names().includes('Private draft'));
    assert.ok(!p.names().includes('Incomplete draft'));
    const published = p.rows().find(row => row.children[0].textContent === 'Published show');
    assert.equal(published.children[6].children[0].textContent, 'View Details');
    assert.equal(published.children[6].children[0].href, 'event-review.php?id=pub%261');
});

test('each status filter works and Review History excludes awaiting submissions and private drafts', async () => {
    const p = page(); await p.ready();
    p.tab('suspended'); assert.deepEqual(p.names(), ['Suspended show']);
    p.tab('cancelled'); assert.deepEqual(p.names(), ['Cancelled show']);
    p.tab('history'); assert.equal(p.names().length, 5);
    assert.ok(!p.names().includes('Pending show'));
    assert.ok(!p.names().includes('Private draft'));
    assert.equal(p.tabs.find(tab => tab.dataset.eventFilter === 'history').attributes['aria-pressed'], 'true');
    assert.equal(p.tabs.find(tab => tab.dataset.eventFilter === 'pending').attributes['aria-pressed'], 'false');
});

test('search and sorting work within the active view using actual submission dates', async () => {
    const p = page(); await p.ready(); p.tab('all');
    assert.equal(p.names()[0], 'Pending show');
    p.sort('newest'); assert.equal(p.names()[0], 'Published show');
    p.search(' alpha '); assert.deepEqual(p.names(), ['Published show']);
    p.search('Theatre'); assert.deepEqual(p.names(), ['Pending show']);
    p.tab('history'); assert.deepEqual(p.names(), []);
    p.search(''); assert.equal(p.names().length, 5);
});

test('draft-only data produces an empty admin queue, never a draft review link', async () => {
    const p = page([records[0]]); await p.ready();
    assert.deepEqual(p.names(), []);
    assert.equal(p.rows()[0].children[0].textContent, 'No events awaiting review.');
    p.tab('all');
    assert.deepEqual(p.names(), []);
    assert.equal(p.elements.get('events-count').textContent, '0 events in this view');
});

test('refresh and browser back update queue membership; failures clear old rows and can be retried', async () => {
    const p = page(); await p.ready();
    p.data(records.filter(record => record.id !== 'pending'));
    p.events.pageshow({ persisted: true });
    await new Promise(setImmediate);
    assert.deepEqual(p.names(), []);
    p.fail(true);
    await p.elements.get('events-refresh').click();
    assert.match(p.rows()[0].children[0].textContent, /Unable to load/);
    p.fail(false); p.data(records);
    await p.elements.get('events-refresh').click();
    assert.deepEqual(p.names(), ['Pending show']);
});

function service() {
    const source = fs.readFileSync(path.join(root, 'assets/js/firestore-crud.js'), 'utf8');
    const code = source.slice(source.indexOf('export const EventService'), source.indexOf('// SEAT SERVICE'))
        .replace('export const EventService =', 'globalThis.service =');
    const queries = [];
    const context = vm.createContext({
        db: {}, collection: (_db, name) => name, doc: (_db, name, id) => ({ name, id }),
        where: (field, op, value) => ({ field, op, value }), query: (name, ...filters) => ({ name, filters }),
        getDocs: async q => {
            queries.push(q);
            return { docs: records.filter(record => q.filters.every(filter => filter.op === 'in'
                ? filter.value.includes(record[filter.field]) : record[filter.field] === filter.value))
                .map(record => ({ id: record.id, data: () => ({ ...record, createdAt: '' }) })) };
        },
        getDoc: async reference => ({ exists: () => records.some(record => record.id === reference.id), id: reference.id,
            data: () => records.find(record => record.id === reference.id) })
    });
    vm.runInContext(code, context);
    return { service: context.service, queries };
}

test('the admin data query excludes drafts before download while organizer queries still include drafts', async () => {
    const p = service();
    const rows = await p.service.getAdminEvents();
    assert.equal(rows.length, 6);
    assert.equal(p.queries[0].filters[0].op, 'in');
    assert.equal(p.queries[0].filters[0].value.includes('DRAFT'), false);
    assert.equal(await p.service.getAdminEvent('draft'), null);
    assert.equal((await p.service.getAdminEvent('pub&1')).status, 'PUBLISHED');
    assert.equal((await p.service.getEvents()).some(record => record.status === 'DRAFT'), true);
    const count = p.queries.length;
    assert.equal((await p.service.getAdminEvents({ status: 'DRAFT' })).length, 0);
    assert.equal(p.queries.length, count, 'a draft filter cannot override the admin query boundary');
});

test('all admin event-list consumers use submitted-only queries and the page serves working filter controls', () => {
    for (const file of ['dashboard.php', 'reports.php', 'events.php']) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, 'admin', file), 'utf8'), /tsEvents\.getEvents\(/);
    }
    for (const file of ['dashboard.php', 'reports.php']) assert.match(fs.readFileSync(path.join(root, 'admin', file), 'utf8'), /tsEvents\.getAdminEvents\(/);
    const html = execFileSync(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', [path.join(root, 'admin/events.php')], { encoding: 'utf8' });
    assert.match(html, /admin-events\.js\?v=\d+/);
    assert.match(html, /data-event-filter="pending" aria-pressed="true"/);
    assert.match(html, /All Submitted Events/);
    assert.match(html, /id="events-search"/);
});
