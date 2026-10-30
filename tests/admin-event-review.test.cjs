const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'admin/event-review.php'), 'utf8');
const event = {
    name: 'Live at the Hall', organizerUid: 'organizer&1', organizerName: 'Organizer One', status: 'PENDING_REVIEW',
    date: '2026-11-25', time: '20:30', eventCategory: 'Concert', description: 'Full event description.\nSecond paragraph.',
    venueId: 'hall&1', venueName: 'Selected Hall', venueLocation: 'Submitted venue address', posterUrl: '/ticksecure-ui/uploads/posters/art.png',
    categories: { A: { name: 'VIP 1', price: 267, quantity: 25 }, B: { name: 'VIP 2', price: 568, quantity: 100 },
        C: { name: 'CAT 1', price: 888, quantity: 90 }, D: { name: 'CAT 2', price: 999, quantity: 159 } },
    salesStartDate: '2026-10-25T10:00', salesEndDate: '2026-11-24T22:00', maxTicketsPerBuyer: 4,
    transferEnabled: false, resaleEnabled: true, resaleStartDate: '2026-10-26', resaleDeadline: '2026-11-23', maxResaleMarkup: 10,
    createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-24T02:00:00Z',
    statusHistory: [
        { to: 'DRAFT', timestamp: '2026-10-20T01:00:00Z', changedBy: 'organizer&1' },
        { to: 'PENDING_REVIEW', timestamp: '2026-10-24T02:00:00Z', changedBy: 'organizer&1' }
    ]
};
const venue = { name: 'Current Hall', address: 'Current address', capacity: 1250, layoutStatus: 'ACTIVE',
    sections: ['A', 'B', 'C', 'D', 'E'].map(sectionId => ({ sectionId, name: 'Physical ' + sectionId, seatCount: 250 })) };
const organizer = { fullName: 'Applicant Name', email: 'organizer@example.com', status: 'active' };
const organization = { organizationName: 'Example Events', organizationPhone: '0123456789', organizationAddress: 'Organization address' };

function page(options = {}) {
    let document;
    class Element {
        constructor() { this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.hidden = false; }
        appendChild(child) { this.children.push(child); return child; }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        replaceChildren(...children) { this.children = []; this.append(...children); }
        get classList() {
            return { toggle: (name, enabled) => {
                const names = new Set((this.className || '').split(' ').filter(Boolean));
                enabled ? names.add(name) : names.delete(name);
                this.className = [...names].join(' ');
            } };
        }
        removeAttribute(name) { delete this.attributes[name]; delete this[name]; }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        focus() { document.activeElement = this; }
        scrollIntoView() { this.scrolled = true; }
        click() { return this.listeners.click?.(); }
    }
    const elements = new Map([...php.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(match => {
        const element = new Element();
        element.hidden = /\bhidden\b/.test(match[0]);
        return [match[1], element];
    }));
    elements.set('.ts-page-title', new Element());
    elements.set('.ts-page-subtitle', new Element());
    const listeners = {}, calls = [];
    let currentEvent = structuredClone(options.event === undefined ? event : options.event);
    let failEvent = options.failEvent;
    let promptResult = ' A clear reason ';
    const confirmations = [];
    document = { getElementById: id => elements.get(id), querySelector: selector => elements.get(selector), createElement: () => new Element() };
    const window = {
        location: new URL('http://localhost/ticksecure-ui/admin/event-review.php' + (options.noId ? '' : '?id=event%261')),
        addEventListener: (type, listener) => { listeners[type] = listener; },
        tsAdminConfirm: async (action, subject) => {
            confirmations.push({ action, subject });
            if (options.confirm === false) return null;
            if (action === 'approveEvent') return {};
            return promptResult?.trim() ? { reason: promptResult.trim() } : null;
        },
        tsEvents: {
            getAdminEvent: async id => { calls.push(['get', id]); if (failEvent) throw new Error('Connection unavailable'); return structuredClone(currentEvent); },
            approveEvent: async id => {
                calls.push(['approve', id]);
                if (options.approve) return options.approve();
                currentEvent.status = 'PUBLISHED';
            },
            rejectEvent: async (id, reason) => { calls.push(['reject', id, reason]); currentEvent.status = 'REJECTED'; currentEvent.rejectReason = reason; },
            suspendEvent: async (id, reason) => { calls.push(['suspend', id, reason]); currentEvent.status = 'SUSPENDED'; currentEvent.suspendReason = reason; }
        },
        tsVenues: { getVenue: async () => { if (options.failVenue) throw new Error('Venue unavailable'); return options.venue === undefined ? venue : options.venue; } },
        tsUsers: {
            getUser: async () => { if (options.failUser) throw new Error('User unavailable'); return options.organizer === undefined ? organizer : options.organizer; },
            getOrganizerProfile: async () => { if (options.failOrganization) throw new Error('Profile unavailable'); return options.organization === undefined ? organization : options.organization; }
        }
    };
    const context = vm.createContext({ window, document, URL, URLSearchParams, Intl });
    for (const file of ['event-policy.js', 'venue-renderer.js', 'admin-event-review.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
    }
    const textContent = element => [element.textContent || '', ...element.children.map(textContent)].join(' ');
    return { get: id => elements.get(id), calls, confirmations, document, window, setStatus: status => { currentEvent.status = status; },
        ready: async (profile = { uid: 'admin-1', role: 'admin', status: 'active' }) => {
            window.tsCurrentUser = profile;
            return listeners['ts-auth-ready']();
        },
        text: id => textContent(elements.get(id)),
        setPrompt: value => { promptResult = value; },
        retryConnection: () => { failEvent = false; }
    };
}

test('review shows the complete submitted schedule, address, description, contacts and timestamps', async () => {
    const p = page();
    await p.ready();
    assert.equal(p.get('event-detail-container').hidden, false);
    assert.equal(p.text('.ts-page-title'), event.name);
    assert.match(p.text('val-schedule'), /25 Nov 2026.*8:30 pm/);
    assert.equal(p.text('val-location'), 'Submitted venue address', 'preserve submitted address over current venue address');
    assert.equal(p.text('val-desc'), event.description);
    assert.equal(p.text('val-org-name'), organizer.fullName);
    assert.equal(p.text('val-org-company'), organization.organizationName);
    assert.equal(p.text('val-org-email'), organizer.email);
    assert.equal(p.text('val-org-phone'), organization.organizationPhone);
    assert.match(p.text('val-submitted'), /24 Oct 2026.*10:00 am/);
    assert.match(p.text('review-history'), /Submitted for approval/);
    assert.equal(p.get('organizer-link').href, 'organizer-detail.php?id=organizer%261');
    assert.equal(p.get('venue-link').href, 'venue-layout.php?id=hall%261');
});

test('partial section allocations show true offered totals and readable physical sections', async () => {
    const p = page();
    await p.ready();
    assert.match(p.text('ticket-totals'), /Tickets offered 374/);
    assert.match(p.text('ticket-totals'), /RM267\.00 – RM999\.00/);
    const rows = p.get('ticket-table-body').children;
    assert.equal(rows.length, 4, 'unused section E does not become ticket inventory');
    assert.deepEqual(rows[0].children.map(cell => cell.textContent), ['VIP 1', 'Physical A', 'RM267.00', '25', '250']);
    assert.equal(p.get('review-venue-board').children.length, 6, 'layout shows stage and five physical sections');
});

test('review uses actual buyer policy with transfer restriction, resale windows and category price examples', async () => {
    const p = page();
    await p.ready();
    const rules = p.text('review-rules');
    assert.match(rules, /Ticket transfers are not allowed/);
    assert.match(rules, /up to 4 tickets/);
    assert.match(rules, /25 Oct 2026.*10:00 am/);
    assert.match(rules, /26 Oct 2026.*23 Nov 2026/);
    assert.match(rules, /10% above/);
    assert.match(rules, /VIP 1: original RM267\.00, maximum resale price RM293\.70/);
    const fixed = page({ event: { ...event, maxResalePrice: 300 } });
    await fixed.ready();
    assert.match(fixed.text('review-rules'), /fixed cap replaces the percentage/);
    assert.match(fixed.text('review-rules'), /maximum resale price RM300\.00/);
});

test('related record failures keep submitted information visible with clear unavailable states', async () => {
    const p = page({ failVenue: true, failUser: true, failOrganization: true });
    await p.ready();
    assert.equal(p.get('event-detail-container').hidden, false);
    assert.equal(p.get('review-notice').hidden, false);
    assert.match(p.text('review-notice'), /capacities are unavailable/);
    assert.equal(p.text('val-org-name'), event.organizerName);
    assert.equal(p.text('val-org-email'), 'Not provided');
    assert.equal(p.get('ticket-table-body').children[0].children[4].textContent, 'Not available');
    assert.equal(p.get('review-venue-board').hidden, true);
    assert.equal(p.get('venue-link').hidden, true);
    assert.equal(p.get('btn-approve').hidden, false);
});

test('legacy categories and incomplete fields do not invent a capacity, time or submission date', async () => {
    const p = page({ event: { ...event, time: '', categories: [{ name: 'Legacy', section: 'Z', price: '', quantity: '' }], statusHistory: [], createdAt: '', updatedAt: '' } });
    await p.ready();
    assert.match(p.text('val-schedule'), /Start time not set/);
    assert.equal(p.get('ticket-table-body').children[0].children[1].textContent, 'Section Z');
    assert.equal(p.get('ticket-table-body').children[0].children[2].textContent, 'Not set');
    assert.equal(p.get('ticket-table-body').children[0].children[4].textContent, 'Not available');
    assert.equal(p.text('val-submitted'), 'Not set');
    assert.match(p.text('ticket-totals'), /Not fully configured/);
});

test('poster can be opened full size; broken or unsafe URLs fall back to text', async () => {
    const p = page();
    await p.ready();
    assert.equal(p.get('poster-link').href, 'http://localhost/ticksecure-ui/uploads/posters/art.png');
    assert.equal(p.get('poster-copy').hidden, true);
    p.get('val-poster').onerror();
    assert.equal(p.get('poster-copy').hidden, false);
    assert.equal(p.get('poster-link').hidden, true);
    const unsafe = page({ event: { ...event, name: '<img src=x onerror=alert(1)>', posterUrl: 'javascript:alert(1)' } });
    await unsafe.ready();
    assert.equal(unsafe.text('.ts-page-title'), '<img src=x onerror=alert(1)>');
    assert.equal(unsafe.get('val-poster').hidden, true);
    assert.equal(unsafe.get('poster-link').href, undefined);
});

test('approval preserves existing confirmation and service behavior, then refreshes action availability', async () => {
    const p = page();
    await p.ready();
    await p.get('btn-approve').click();
    assert.deepEqual(p.calls, [['get', 'event&1'], ['get', 'event&1'], ['approve', 'event&1'], ['get', 'event&1']]);
    assert.equal(p.get('btn-approve').hidden, true);
    assert.equal(p.get('btn-reject').hidden, true);
    assert.equal(p.get('btn-suspend').hidden, false);
    assert.equal(p.text('val-status'), 'Published');
    assert.deepEqual(p.confirmations[0], { action: 'approveEvent', subject: event.name });
    await p.get('btn-suspend').click();
    assert.deepEqual(p.calls.at(-2), ['suspend', 'event&1', 'A clear reason']);
    assert.equal(p.get('action-buttons').hidden, true);
    assert.match(p.text('review-history'), /Current decision reason: A clear reason/);
});

test('rejection requires a reason and displays the stored decision; cancelled decisions do not write', async () => {
    const p = page();
    await p.ready();
    p.setPrompt('   ');
    await p.get('btn-reject').click();
    assert.equal(p.calls.length, 1);
    p.setPrompt(' Missing details ');
    await p.get('btn-reject').click();
    assert.deepEqual(p.calls.at(-2), ['reject', 'event&1', 'Missing details']);
    assert.equal(p.text('val-status'), 'Rejected');
    assert.match(p.text('review-history'), /Current decision reason: Missing details/);
    const cancelled = page({ confirm: false });
    await cancelled.ready();
    await cancelled.get('btn-approve').click();
    assert.equal(cancelled.calls.length, 1);
});

test('decision failures retain the review and focus an error; duplicate clicks are blocked while saving', async () => {
    let reject;
    const p = page({ approve: () => new Promise((_resolve, fail) => { reject = fail; }) });
    await p.ready();
    const pending = p.get('btn-approve').click();
    await new Promise(setImmediate);
    assert.equal(p.get('btn-reject').disabled, true);
    await p.get('btn-approve').click();
    assert.equal(p.calls.filter(call => call[0] === 'approve').length, 1);
    reject(new Error('Unable to save decision'));
    await pending;
    assert.equal(p.get('event-detail-container').hidden, false);
    assert.equal(p.document.activeElement, p.get('review-error'));
    assert.match(p.text('review-error'), /Unable to save decision/);
    assert.equal(p.get('btn-approve').disabled, false);
});

test('invalid or failed event loads hide decision actions and support retry', async () => {
    const missing = page({ noId: true });
    await missing.ready();
    assert.equal(missing.calls.length, 0);
    assert.match(missing.text('review-error'), /No event was selected/);
    const removed = page({ event: null });
    await removed.ready();
    assert.equal(removed.get('action-buttons').hidden, true);
    assert.match(removed.text('review-error'), /Event not found/);
    const retry = page({ failEvent: true });
    await retry.ready();
    assert.equal(retry.get('review-retry').hidden, false);
    retry.retryConnection();
    await retry.get('review-retry').click();
    assert.equal(retry.get('review-error').hidden, true);
    assert.equal(retry.get('event-detail-container').hidden, false);
});

test('review loads only after an active admin profile and ignores duplicate auth-ready events', async () => {
    const p = page();
    await p.ready({ role: 'organizer', status: 'active' });
    await p.ready({ role: 'admin', status: 'suspended' });
    assert.equal(p.calls.length, 0);
    await p.ready();
    await p.ready();
    assert.equal(p.calls.length, 1);
});

test('PHP review page renders all sections and versioned shared scripts', () => {
    const html = execFileSync(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', [path.join(root, 'admin/event-review.php')], { encoding: 'utf8' });
    for (const file of ['event-policy', 'venue-renderer', 'admin-event-review']) assert.match(html, new RegExp(file + '\\.js\\?v=\\d+'));
    for (const title of ['Event Description', 'Ticket Categories &amp; Allocation', 'Sales, Transfer &amp; Resale Rules', 'Organizer Contact', 'Submission &amp; Decision History']) assert.ok(html.includes(title));
    assert.match(html, /id="event-detail-container" class="ts-review-layout" hidden/);
    assert.match(html, /target="_blank" rel="noopener noreferrer" hidden/);
});

test('published events expose only suspension and ignore approval/rejection clicks', async () => {
    const p = page({ event: { ...event, status: 'PUBLISHED' } });
    await p.ready();
    assert.equal(p.get('btn-approve').hidden, true);
    assert.equal(p.get('btn-reject').hidden, true);
    assert.equal(p.get('btn-suspend').hidden, false);
    await p.get('btn-approve').click();
    await p.get('btn-reject').click();
    assert.equal(p.confirmations.length, 0);
    assert.deepEqual(p.calls, [['get', 'event&1']]);
    const css = fs.readFileSync(path.join(root, 'assets/css/ticksecure.css'), 'utf8');
    // An ID selector outranks .ts-btn's display:inline-flex, unlike the browser's
    // default [hidden] rule that previously left these buttons visible.
    assert.match(css, /#action-buttons \[hidden\][^{]*\{\s*display:\s*none\s*;/);
    for (const id of ['btn-approve', 'btn-reject', 'btn-suspend']) assert.match(php, new RegExp('id="' + id + '"[^>]+hidden'));
});

test('draft URLs never render event details or expose moderation controls', async () => {
    const p = page({ event: { ...event, status: 'DRAFT' } });
    await p.ready();
    assert.equal(p.get('event-detail-container').hidden, true);
    assert.equal(p.get('action-buttons').hidden, true);
    assert.match(p.text('review-error'), /Drafts are visible only in the organizer workspace/);
    await p.get('btn-approve').click();
    assert.equal(p.confirmations.length, 0);
});

test('a status change while confirming prevents a stale approval and refreshes the buttons', async () => {
    const p = page();
    await p.ready();
    p.setStatus('PUBLISHED');
    await p.get('btn-approve').click();
    assert.equal(p.calls.some(call => call[0] === 'approve'), false);
    assert.equal(p.get('btn-approve').hidden, true);
    assert.equal(p.get('btn-reject').hidden, true);
    assert.equal(p.get('btn-suspend').hidden, false);
    assert.match(p.text('review-error'), /status has changed/);
});

test('reviewed and cancelled records expose no approval or rejection controls', async () => {
    for (const status of ['REJECTED', 'SUSPENDED', 'CANCELLED']) {
        const p = page({ event: { ...event, status } });
        await p.ready();
        assert.equal(p.get('action-buttons').hidden, true);
        await p.get('btn-approve').click();
        await p.get('btn-reject').click();
        assert.equal(p.confirmations.length, 0);
    }
});
