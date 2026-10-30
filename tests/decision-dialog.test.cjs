const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
function fixture() {
    let document;
    class Element {
        constructor() { this.listeners = {}; this.children = []; this.attributes = {}; this.value = ''; this.isConnected = true; this.disabled = false; }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); }
        replaceChildren(...children) { this.children = children; }
        setAttribute(key, value) { this.attributes[key] = value; }
        removeAttribute(key) { delete this.attributes[key]; }
        focus() { document.activeElement = this; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        click() { return this.listeners.click?.({ target: this }); }
        getBoundingClientRect() { return { left: 100, right: 600, top: 100, bottom: 500 }; }
    }
    const elements = Object.fromEntries(['dialog','title','message','subject','details','submit','cancel','close','form','fields'].map(id => [id, new Element()]));
    const trigger = new Element(), events = {}, adminElements = {};
    const window = { tsCurrentUser: { uid: 'buyer', role: 'buyer', status: 'active' },
        addEventListener(type, listener) { events[type] = listener; },
        confirm() { throw Error('Native confirmation must not be used'); }, prompt() { throw Error('Native prompt must not be used'); } };
    document = { activeElement: trigger, getElementById: id => id.startsWith('admin-confirm-') ? (adminElements[id] ||= new Element()) : elements[id.replace('ts-decision-', '')], createElement: () => new Element() };
    const context = vm.createContext({ window, document });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/decision-dialog.js'), 'utf8'), context);
    return { window, elements, trigger, events, document, context,
        open: (...args) => window.tsDecision(...args),
        submit: () => elements.form.listeners.submit({ preventDefault() {} }),
        fields: () => elements.fields.children.map(wrapper => ({ input: wrapper.children[1], error: wrapper.children[2] })) };
}
test('custom dialog requires an explicit choice and Cancel, Escape, close and backdrop all cancel', async () => {
    const p = fixture();
    for (const dismiss of [
        () => p.elements.cancel.click(), () => p.elements.close.click(),
        () => p.elements.dialog.listeners.cancel({ preventDefault() {} }),
        () => p.elements.dialog.listeners.click({ target: p.elements.dialog, clientX: 0, clientY: 0 })
    ]) {
        let settled = false;
        const result = p.open('logout', 'Current session').then(value => { settled = true; return value; });
        await Promise.resolve(); assert.equal(settled, false);
        assert.equal(p.document.activeElement, p.elements.cancel);
        assert.equal(p.elements.cancel.textContent, 'Stay signed in');
        dismiss(); assert.equal(await result, null);
        assert.equal(p.document.activeElement, p.trigger);
    }
    const result = p.open('logout', 'Session');
    // Clicking whitespace within the card is not a backdrop dismissal.
    p.elements.dialog.listeners.click({ target: p.elements.dialog, clientX: 120, clientY: 120 });
    assert.equal(p.elements.dialog.open, true);
    p.submit(); assert.deepEqual(JSON.parse(JSON.stringify(await result)), {});
});
test('duplicate or unknown requests cannot replace another pending decision', async () => {
    const p = fixture();
    const first = p.open('deleteDraft', 'Original draft');
    assert.equal(await p.open('logout', 'Other action'), null);
    assert.equal(await p.open('missing', 'Other action'), null);
    assert.equal(p.elements.subject.textContent, 'Original draft');
    p.elements.cancel.click(); await first;
});
test('resale repricing uses a custom validated field and returns only the confirmed cent price', async () => {
    const p = fixture();
    const result = p.open('repriceListing', 'Concert', [['Maximum', 'RM80.00']], { price: '50.00', maximum: 80 });
    const { input, error } = p.fields()[0];
    assert.equal(input.value, '50.00');
    for (const value of ['0', '-1', '1.001', '1e2', '80.01', '']) {
        input.value = value; p.submit();
        assert.equal(p.elements.dialog.open, true);
        assert.equal(input.attributes['aria-invalid'], 'true');
        assert.equal(error.hidden, false);
    }
    input.value = ' 75.50 '; input.listeners.input();
    assert.equal(input.attributes['aria-invalid'], undefined);
    p.submit(); assert.deepEqual(JSON.parse(JSON.stringify(await result)), { price: '75.50' });
    assert.equal(p.elements.fields.children.length, 0);
});
test('session changes, role loss and page exit cancel pending actions', async () => {
    const p = fixture();
    let result = p.open('transferTicket', 'Ticket');
    p.window.tsCurrentUser.uid = 'another'; p.submit();
    assert.equal(await result, null);
    result = p.open('purchaseResale', 'Ticket'); p.events.pagehide();
    assert.equal(await result, null);
    p.window.tsCurrentUser = { uid: 'admin', role: 'admin', status: 'active' };
    result = p.window.tsConfirmDecision({ title: 'Approve', requireAdmin: true });
    p.window.tsCurrentUser.status = 'suspended'; p.events['ts-profile-updated']();
    assert.equal(await result, null);
});
test('admin decisions use the new component and keep required reasons and administrator checks', async () => {
    const p = fixture();
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/admin-confirmations.js'), 'utf8'), p.context);
    assert.equal(await p.window.tsAdminConfirm('suspendUser', 'Account'), null);
    p.window.tsCurrentUser = { uid: 'admin', role: 'admin', status: 'active' };
    const result = p.window.tsAdminConfirm('suspendUser', '<img src=x>', [['Email', '<script>unsafe</script>']]);
    assert.equal(p.elements.subject.textContent, '<img src=x>');
    assert.equal(p.elements.details.children[1].textContent, '<script>unsafe</script>');
    const { input, error } = p.fields()[0];
    input.value = ' '; p.submit(); assert.equal(error.hidden, false);
    input.value = '  Confirmed misuse  '; p.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(await result)), { reason: 'Confirmed misuse' });
});
test('all role layouts include exactly one standalone custom dialog and versioned assets', () => {
    const php = process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php';
    for (const mode of ['admin', 'organizer', 'buyer', 'auth']) {
        const html = execFileSync(php, ['-r', `require $argv[1]; $role=$argv[2]; if ($role==='buyer') render_public_page('Test','events','', '..'); elseif ($role==='auth') render_auth_page('Test',''); else render_dashboard_page($role,'Test','dashboard','');`, path.join(root, 'shared/ui.php'), mode], { encoding: 'utf8' });
        assert.equal((html.match(/id="ts-decision-dialog"/g) || []).length, 1, mode);
        assert.match(html, /decision-dialog\.css\?v=\d+/);
        assert.match(html, /decision-dialog\.js\?v=\d+/);
        assert.match(html, /aria-labelledby="ts-decision-title" aria-describedby="ts-decision-message"/);
    }
});
test('dashboard logout signs out only after confirmation and restores controls on cancel or failure', async () => {
    for (const choice of [null, {}, 'failure']) {
        const p = fixture(); const button = p.trigger; let signOuts = 0;
        p.document.querySelector = () => button;
        p.window.tsAuth = { logout: async () => { signOuts++; if (choice === 'failure') throw Error('Failed'); } };
        p.window.tsDecision = async () => choice === 'failure' ? {} : choice;
        vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/dashboard-logout.js'), 'utf8'), p.context);
        await button.click();
        assert.equal(signOuts, choice === null ? 0 : 1);
        assert.equal(button.disabled, false);
    }
});


test('public logout cancellation preserves the session; confirmed logout clears only TickSecure storage', async () => {
    for (const decision of [null, {}]) {
        const callbacks = {}, redirects = [], values = new Map([['ticksecure.test', 'saved'], ['unrelated', 'keep']]);
        let signOuts = 0, sessionClears = 0;
        const button = { addEventListener(type, cb) { callbacks[type] = cb; } };
        const window = { tsCurrentUser: { uid: 'buyer', role: 'buyer', status: 'active' },
            location: { pathname: '/ticksecure-ui/buyer/tickets.php', replace: value => redirects.push(value) },
            tsDecision: async () => decision };
        const source = fs.readFileSync(path.join(root, 'assets/js/auth-guard.js'), 'utf8')
            .replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', JSON.stringify('http://localhost/ticksecure-ui/assets/js/auth-guard.js'));
        vm.runInNewContext(source, { window, URL, auth: {}, db: {},
            document: { getElementById: id => id === 'public-logout-btn' ? button : null },
            onAuthStateChanged() {}, signOut: async () => { signOuts++; },
            sessionStorage: { clear: () => { sessionClears++; } },
            localStorage: { get length() { return values.size; }, key: index => [...values.keys()][index], removeItem: key => values.delete(key) },
            console: { error() {}, warn() {} } });
        await callbacks.click();
        assert.equal(signOuts, decision ? 1 : 0);
        assert.equal(sessionClears, decision ? 1 : 0);
        assert.equal(values.has('ticksecure.test'), !decision);
        assert.equal(values.get('unrelated'), 'keep');
        assert.equal(redirects.length, decision ? 1 : 0);
    }
});
