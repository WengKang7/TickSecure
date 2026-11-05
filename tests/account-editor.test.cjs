const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');

async function page({ id = 'buyer', status = 'active' } = {}) {
    const events = {}, elements = new Map(), calls = [], control = { decision: true };
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', disabled: false, hidden: false, type: 'password', attrs: {}, events: {},
            addEventListener(name, callback) { this.events[name] = callback; }, setAttribute(key, value) { this.attrs[key] = value; }, append() {} });
        return elements.get(id);
    };
    element('account-save').disabled = true;
    const form = element('account-form');
    form.elements = Object.fromEntries(['fullName', 'email', 'role', 'password', 'organizationName', 'organizationPhone', 'organizationAddress', 'organizationDescription'].map(key => [key, element(key)]));
    form.elements.role.value = 'buyer'; form.reportValidity = () => true; form.reset = () => {};
    const window = { addEventListener: (name, callback) => { events[name] = callback; },
        tsUsers: { getUser: async () => ({ fullName: 'Buyer One', role: 'buyer', email: 'buyer@example.com', status }), getOrganizerProfile: async () => ({ organizationName: 'Old company' }) },
        tsDecision: async () => control.decision };
    const context = { window, document: { getElementById: element, createElement: element }, location: { search: id ? '?id=' + id : '' }, URLSearchParams,
        invokeTrustedBackend: async (data, config) => { calls.push({ data, config }); return { emailChanged: true }; },
        AccountCrud: { create: async data => { calls.push({ create: data }); return { id: 'new', verificationSent: true }; } },
        FormData: class { constructor() { this.data = Object.entries(form.elements).filter(([name]) => !name.startsWith('organization') || !element('organization-fields').disabled).map(([name, input]) => [name, input.value]); } [Symbol.iterator]() { return this.data[Symbol.iterator](); } }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/validation.js'), 'utf8').replace(/export /g, ''), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/account-editor.js'), 'utf8').replace(/^import .*\r?\n/gm, ''), context);
    window.tsCurrentUser = { uid: 'admin', role: 'admin', status: 'active' };
    await events['ts-auth-ready']();
    return { element, form, calls, control, submit: () => form.events.submit({ preventDefault() {} }) };
}

test('editor enables email/role, shows an optional new password and never retrieves an existing password', async () => {
    const p = await page();
    assert.equal(p.form.elements.email.disabled, false); assert.equal(p.form.elements.role.disabled, false);
    assert.equal(p.form.elements.password.required, false); assert.equal(p.form.elements.password.value, '');
    assert.match(p.element('password-help').textContent, /cannot be retrieved/);
    p.form.elements.password.value = 'New!Password123'; p.element('password-show').events.click();
    assert.equal(p.form.elements.password.type, 'text'); assert.equal(p.element('password-show').attrs['aria-pressed'], 'true');
    p.form.elements.email.value = 'new@example.com';
    await p.submit();
    assert.equal(p.calls[0].data.password, 'New!Password123'); assert.equal(p.calls[0].data.email, 'new@example.com');
    assert.equal(p.calls[0].data.action, 'edit'); assert.equal(p.calls[0].config.name, 'manageAdminAccount');
    assert.equal(p.form.elements.password.value, ''); assert.equal(p.form.elements.password.type, 'password');
    assert.match(p.element('account-message').textContent, /verify their new email/);
});

test('blank password is allowed on edit; cancellation and invalid input never send account changes', async () => {
    const p = await page(); p.control.decision = false; await p.submit(); assert.equal(p.calls.length, 0);
    p.control.decision = true; p.form.elements.email.value = 'bad email'; await p.submit(); assert.equal(p.calls.length, 0);
    p.form.elements.email.value = 'buyer@example.com'; p.form.elements.password.value = 'weak'; await p.submit(); assert.equal(p.calls.length, 0);
    p.form.elements.password.value = ''; await p.submit(); assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].data.password, ''); assert.equal(p.element('account-save').disabled, false);
});

test('role changes require organization details and deleted accounts cannot be saved', async () => {
    const p = await page(); p.form.elements.role.value = 'organizer'; p.form.elements.role.events.change();
    assert.equal(p.element('organization-fields').disabled, false);
    await p.submit(); assert.equal(p.calls.length, 0);
    Object.assign(p.form.elements.organizationPhone, { value: '+60123456789' }); await p.submit();
    assert.equal(p.calls[0].data.role, 'organizer');
    const deleted = await page({ status: 'deleted' }); await deleted.submit(); assert.equal(deleted.calls.length, 0); assert.equal(deleted.element('account-save').disabled, true);
});

test('new account still uses separate Firebase registration and requires an initial password', async () => {
    const p = await page({ id: '' }); p.form.elements.fullName.value = 'New Buyer'; p.form.elements.email.value = 'new@example.com';
    await p.submit(); assert.equal(p.calls.length, 0);
    p.form.elements.password.value = 'Initial!123'; await p.submit();
    assert.equal(p.calls[0].create.password, 'Initial!123'); assert.equal(p.element('account-save').disabled, true);
    const markup = fs.readFileSync(path.join(root, 'admin/account-edit.php'), 'utf8');
    assert.doesNotMatch(markup, /account-archive|Archive account/);
});
