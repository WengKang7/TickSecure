const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');

function modal() {
    let document;
    class Element {
        constructor() { this.listeners = {}; this.children = []; this.value = ''; this.attributes = {}; this.isConnected = true; }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); }
        replaceChildren() { this.children = []; }
        focus() { document.activeElement = this; }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
        setCustomValidity(message) { this.validationMessage = message; }
        reportValidity() { return !this.validationMessage && this.value.length <= this.maxLength; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        click() { return this.listeners.click?.({ target: this }); }
    }
    const names = ['dialog', 'title', 'message', 'subject', 'details', 'submit', 'cancel', 'close', 'form', 'fields'];
    const elements = Object.fromEntries(names.map(name => [name, new Element()]));
    const trigger = new Element();
    const events = {};
    document = { activeElement: trigger, getElementById: id => elements[id.replace('admin-confirm-', '')], createElement: () => new Element() };
    const window = { tsCurrentUser: { uid: 'admin', role: 'admin', status: 'active' }, addEventListener: (type, callback) => { events[type] = callback; } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/admin-confirmations.js'), 'utf8'), { window, document });
    const fields = () => elements.fields.children.map(wrapper => wrapper.children[1]);
    return { elements, window, document, trigger, events, fields,
        open: (...args) => window.tsAdminConfirm(...args),
        submit: () => elements.form.listeners.submit({ preventDefault() {} }) };
}

test('all important action types show their target and a specific confirmation button', async () => {
    const p = modal();
    for (const action of ['approveEvent', 'rejectEvent', 'suspendEvent', 'approveOrganizer', 'rejectOrganizer', 'suspendUser', 'reactivateUser', 'deleteVenue', 'updateVenue', 'confirmSections', 'activateLayout', 'replaceBlueprint', 'suspendListing', 'investigateComplaint', 'rejectComplaint', 'resolveComplaint']) {
        const result = p.open(action, 'Example record', [['Email', 'example@test.com']]);
        assert.equal(p.elements.dialog.open, true, action);
        assert.equal(p.elements.subject.textContent, 'Example record');
        assert.notEqual(p.elements.submit.textContent, 'Confirm');
        assert.ok(p.elements.message.textContent.length > 30);
        assert.equal(p.document.activeElement, p.elements.cancel);
        assert.equal(p.elements.details.children[1].textContent, 'example@test.com');
        p.elements.cancel.click();
        assert.equal(await result, null);
    }
});

test('opening a confirmation waits for an explicit choice and Cancel/Escape/close/backdrop never confirm', async () => {
    const p = modal();
    const dismiss = [
        () => p.elements.cancel.click(), () => p.elements.close.click(),
        () => p.elements.dialog.listeners.cancel({ preventDefault() {} }),
        () => p.elements.dialog.listeners.click({ target: p.elements.dialog })
    ];
    for (const cancel of dismiss) {
        let settled = false;
        const result = p.open('deleteVenue', 'Draft hall').then(value => { settled = true; return value; });
        await Promise.resolve();
        assert.equal(settled, false);
        cancel();
        assert.equal(await result, null);
        assert.equal(p.elements.dialog.open, false);
        assert.equal(p.document.activeElement, p.trigger);
    }
    const confirmed = p.open('approveEvent', 'Concert');
    p.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(await confirmed)), {});
});

test('rejection and suspension require a nonblank reason, focus the field and return trimmed text', async () => {
    const p = modal();
    const result = p.open('suspendUser', 'Example account');
    const input = p.fields()[0];
    input.value = '   ';
    p.submit();
    assert.equal(p.elements.dialog.open, true);
    assert.equal(input.attributes['aria-invalid'], 'true');
    assert.equal(p.document.activeElement, input);
    input.value = '  Repeated misuse  ';
    input.listeners.input();
    assert.equal(input.attributes['aria-invalid'], undefined);
    p.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(await result)), { reason: 'Repeated misuse' });
    assert.equal(p.elements.fields.children.length, 0, 'reason is cleared after closing');
});

test('complaint resolution requires both the action and explanation', async () => {
    const p = modal();
    const result = p.open('resolveComplaint', 'CMP-123');
    const [action, explanation] = p.fields();
    action.value = ' Contacted organizer ';
    p.submit();
    assert.equal(p.document.activeElement, explanation);
    assert.equal(p.elements.dialog.open, true);
    explanation.value = '  Organizer confirmed the corrected booking details.  ';
    p.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(await result)), { action: 'Contacted organizer', explanation: 'Organizer confirmed the corrected booking details.' });
});

test('duplicate or unknown confirmation requests cannot replace an existing decision', async () => {
    const p = modal();
    assert.equal(await p.open('unknownAction', 'Other record'), null);
    const first = p.open('approveEvent', 'Original event');
    assert.equal(await p.open('deleteVenue', 'Different record'), null);
    assert.equal(p.elements.subject.textContent, 'Original event');
    p.elements.cancel.click();
    assert.equal(await first, null);
});

test('record names, details and reasons remain plain text and old input is not reused', async () => {
    const p = modal();
    const result = p.open('rejectEvent', '<img src=x onerror=alert(1)>', [['Venue', '<script>bad()</script>']]);
    assert.equal(p.elements.subject.textContent, '<img src=x onerror=alert(1)>');
    assert.equal(p.elements.details.children[1].textContent, '<script>bad()</script>');
    p.fields()[0].value = 'Private rejection reason';
    p.elements.cancel.click();
    await result;
    const second = p.open('rejectOrganizer', 'Another application');
    assert.equal(p.fields()[0].value, '');
    assert.equal(p.elements.details.hidden, true);
    p.elements.cancel.click();
    await second;
});

test('page exit and losing admin access cancel a pending decision', async () => {
    const p = modal();
    const first = p.open('activateLayout', 'Hall');
    p.events.pagehide();
    assert.equal(await first, null);
    const second = p.open('deleteVenue', 'Hall');
    p.window.tsCurrentUser = null;
    p.events['ts-auth-ready']({ detail: null });
    assert.equal(await second, null);
    assert.equal(await p.open('approveEvent', 'Event'), null);
});

test('shared layout loads the accessible confirmation dialog for admins only', () => {
    const render = role => execFileSync(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['-r', "require $argv[1]; render_dashboard_page($argv[2], 'Test', 'dashboard', '');", path.join(root, 'shared/ui.php'), role], { encoding: 'utf8' });
    const html = render('admin');
    assert.match(html, /<dialog id="admin-confirm-dialog"[^>]+aria-labelledby="admin-confirm-title"[^>]+aria-describedby="admin-confirm-message"/);
    assert.match(html, /admin-confirmations\.js\?v=\d+/);
    assert.match(html, /id="admin-confirm-cancel" type="button"/);
    assert.match(html, /id="admin-confirm-submit" type="submit"/);
    assert.doesNotMatch(render('organizer'), /admin-confirm-dialog|admin-confirmations\.js/);
});

async function adminPage(file) {
    const markup = fs.readFileSync(path.join(root, 'admin', file), 'utf8');
    const source = markup.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    const elements = new Map(), writes = [], confirmations = [], errors = [];
    const control = { decision: null };
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            value: id === 'resale-risk-filter' ? 'ALL' : '', style: {}, dataset: { id: 'record-1' }, listeners: {}, disabled: false,
            addEventListener(type, listener) { this.listeners[type] = listener; },
            querySelectorAll: selector => selector === '.action-suspend' ? [element('listing-button')] : [],
            click() { return (this.onclick || this.listeners.click)?.({ preventDefault() {} }); }
        });
        return elements.get(id);
    }
    const venue = { id: 'record-1', name: 'Example Hall', address: 'Venue address', capacity: 100, sections: [], layoutStatus: 'DRAFT' };
    const user = { id: 'record-1', fullName: 'Applicant Name', email: 'applicant@example.com', role: 'organizer', status: file === 'organizer-detail.php' ? 'pending' : 'active' };
    const complaint = { id: 'record-1', referenceNumber: 'CMP-1', status: 'OPEN' };
    let ready;
    const window = {
        location: { search: '?id=record-1' },
        addEventListener: (_event, callback) => { ready = callback; },
        tsAdminConfirm: async (...args) => { confirmations.push(args); return control.decision; },
        alert: message => errors.push(message),
        tsUsers: {
            getUser: async () => user, getOrganizerProfile: async () => ({ organizationName: 'Example Events' }),
            approveOrganizer: async (...args) => writes.push(['approveOrganizer', ...args]),
            rejectOrganizer: async (...args) => writes.push(['rejectOrganizer', ...args]),
            suspendUser: async (...args) => writes.push(['suspendUser', ...args]),
            reactivateUser: async (...args) => writes.push(['reactivateUser', ...args])
        },
        tsVenues: {
            getVenue: async () => venue, getVenues: async () => [venue],
            updateVenue: async (...args) => writes.push(['updateVenue', ...args]),
            deleteVenue: async (...args) => writes.push(['deleteVenue', ...args])
        },
        tsComplaints: {
            getComplaint: async () => complaint,
            updateStatus: async (...args) => writes.push(['updateStatus', ...args]),
            reject: async (...args) => writes.push(['rejectComplaint', ...args]),
            resolve: async (...args) => writes.push(['resolveComplaint', ...args])
        },
        tsResale: {
            getListings: async () => [{ id: 'record-1', eventName: 'Example Event', status: 'ACTIVE' }],
            suspendListing: async (...args) => writes.push(['suspendListing', ...args])
        }
    };
    vm.runInNewContext(source, {
        window, document: { getElementById: element, querySelector: element, querySelectorAll: selector => selector === '.delete-btn' ? [element('delete-button')] : [] },
        URL, URLSearchParams, alert: window.alert, console: { error: (...args) => errors.push(args) }
    });
    await ready({ detail: { uid: 'admin', role: 'admin', status: 'active' } });
    assert.deepEqual(errors, [], file + ' loads successfully');
    return { element, writes, confirmations, control, errors, user };
}

test('organizer approval and rejection never write on cancel and use the confirmed application and reason', async () => {
    for (const [button, action] of [['btn-approve', 'approveOrganizer'], ['btn-reject', 'rejectOrganizer']]) {
        const p = await adminPage('organizer-detail.php');
        await p.element(button).click();
        assert.deepEqual(p.writes, []);
        assert.equal(p.confirmations[0][0], action);
        assert.equal(p.confirmations[0][1], 'Example Events');
        p.control.decision = { reason: 'Missing information' };
        await p.element(button).click();
        assert.deepEqual(p.writes[0], action === 'approveOrganizer' ? [action, 'record-1'] : [action, 'record-1', 'Missing information']);
        assert.equal(p.element(button).disabled, false);
    }
});

test('user detail account suspension and reactivation require confirmation', async () => {
    const p = await adminPage('user-detail.php');
    await p.element('btn-toggle-status').click();
    assert.deepEqual(p.writes, []);
    assert.equal(p.confirmations[0][0], 'suspendUser');
    p.control.decision = { reason: 'Misuse' };
    await p.element('btn-toggle-status').click();
    assert.deepEqual(p.writes[0], ['suspendUser', 'record-1', 'Misuse']);
    p.user.status = 'suspended';
    // A fresh load installs the reactivation handler for a suspended account.
    await p.element('btn-toggle-status').click();
    p.control.decision = null;
    const before = p.writes.length;
    await p.element('btn-toggle-status').click();
    assert.equal(p.confirmations.at(-1)[0], 'reactivateUser');
    assert.equal(p.writes.length, before);
});

test('complaint investigation, rejection and resolution all stop on cancel and save the confirmed fields', async () => {
    for (const [button, action, expected] of [
        ['btn-investigate', 'investigateComplaint', ['updateStatus', 'record-1', 'UNDER_INVESTIGATION', 'Administrator review started.']],
        ['btn-reject', 'rejectComplaint', ['rejectComplaint', 'record-1', 'Reason']],
        ['btn-resolve', 'resolveComplaint', ['resolveComplaint', 'record-1', 'Corrected details', 'Confirmed with organizer']]
    ]) {
        const p = await adminPage('complaint-detail.php');
        await p.element(button).click();
        assert.deepEqual(p.writes, []);
        assert.equal(p.confirmations[0][0], action);
        p.control.decision = { reason: 'Reason', action: 'Corrected details', explanation: 'Confirmed with organizer' };
        await p.element(button).click();
        assert.deepEqual(p.writes[0], expected);
        assert.equal(p.element(button).disabled, false);
    }
});

test('venue deletion and detail edits do not mutate or close the edit form on cancel', async () => {
    const deletion = await adminPage('venues.php');
    await deletion.element('delete-button').click();
    assert.deepEqual(deletion.writes, []);
    assert.equal(deletion.confirmations[0][0], 'deleteVenue');
    deletion.control.decision = {};
    await deletion.element('delete-button').click();
    assert.deepEqual(deletion.writes[0], ['deleteVenue', 'record-1']);
    const edit = await adminPage('venue-detail.php');
    edit.element('btn-edit').click();
    edit.element('edit-name').value = 'Updated Hall';
    edit.element('edit-address').value = 'Updated address';
    edit.element('edit-capacity').value = '120';
    await edit.element('btn-save-edit').click();
    assert.deepEqual(edit.writes, []);
    assert.equal(edit.element('edit-modal').style.display, 'flex');
    assert.equal(edit.element('edit-name').value, 'Updated Hall');
    edit.control.decision = {};
    await edit.element('btn-save-edit').click();
    assert.deepEqual(JSON.parse(JSON.stringify(edit.writes[0])), ['updateVenue', 'record-1', { name: 'Updated Hall', address: 'Updated address', capacity: 120 }]);
});

test('resale suspension uses the confirmed listing and reason and leaves cancelled listings alone', async () => {
    const p = await adminPage('resale.php');
    await p.element('listing-button').click();
    assert.deepEqual(p.writes, []);
    assert.equal(p.confirmations[0][0], 'suspendListing');
    assert.equal(p.confirmations[0][1], 'Example Event');
    p.control.decision = { reason: 'Pricing violation' };
    await p.element('listing-button').click();
    assert.deepEqual(p.writes[0], ['suspendListing', 'record-1', 'Pricing violation']);
});
