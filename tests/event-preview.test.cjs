const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');

function previewControls() {
    class Control {
        constructor(attributes = {}) { this.attributes = { ...attributes }; this.disabled = false; }
        getAttribute(key) { return this.attributes[key]; }
        hasAttribute(key) { return key in this.attributes; }
        setAttribute(key, value) { this.attributes[key] = value; }
        removeAttribute(key) { delete this.attributes[key]; }
        closest() { return this; }
    }
    const button = new Control(), input = new Control(), link = new Control({ href: 'buyer/seat-picker.php' });
    const summary = new Control(), details = { open: false };
    const native = [button, input], controls = [button, input, link, summary];
    const listeners = {};
    let refresh, observerOptions, className;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/event-preview.js'), 'utf8'), {
        document: {
            body: { classList: { add(value) { className = value; } } },
            querySelectorAll(selector) { return selector === 'details' ? [details] : selector === 'button,input,select,textarea' ? native : controls; },
            addEventListener(type, handler, capture) { listeners[type] = { handler, capture }; }
        },
        MutationObserver: class { constructor(callback) { refresh = callback; } observe(_target, options) { observerOptions = options; } }
    });
    return { button, input, link, summary, details, native, controls, listeners, refresh: () => refresh(),
        options: observerOptions, className, Control };
}

test('preview disables all native controls and navigation while keeping policies expanded for reading', () => {
    const p = previewControls();
    assert.equal(p.className, 'ts-view-only-preview');
    assert.ok(p.native.every(control => control.disabled));
    assert.ok(p.controls.every(control => control.getAttribute('aria-disabled') === 'true' && control.getAttribute('tabindex') === '-1'));
    assert.equal(p.link.hasAttribute('href'), false);
    assert.equal(p.details.open, true);
    assert.equal(p.listeners.click.capture, true);
    assert.equal(p.listeners.keydown.capture, true);
});

test('dynamic controls and later attempts to re-enable links stay disabled', () => {
    const p = previewControls();
    const later = new p.Control({ href: 'auth/logout.php' });
    p.controls.push(later);
    p.button.disabled = false;
    p.link.setAttribute('href', 'events.php');
    p.refresh();
    assert.equal(p.button.disabled, true);
    assert.equal(p.link.hasAttribute('href'), false);
    assert.equal(later.hasAttribute('href'), false);
    assert.equal(later.getAttribute('tabindex'), '-1');
    assert.equal(p.options.subtree, true);
    assert.equal(p.options.attributes, true);
});

test('preview blocks pointer and keyboard activation without blocking scrolling keys', () => {
    const p = previewControls();
    for (const [type, key] of [['click'], ['keydown', 'Enter'], ['keydown', ' ']]) {
        let prevented = false, stopped = false;
        p.listeners[type].handler({ type, key, target: p.link,
            preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
        assert.equal(prevented, true);
        assert.equal(stopped, true);
    }
    p.listeners.keydown.handler({ type: 'keydown', key: 'PageDown', target: p.link,
        preventDefault() { throw Error('Scrolling must remain available'); } });
});

test('only the explicit preview URL receives the viewing banner and disabling script', () => {
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const file = path.join(root, 'public/event-detail.php');
    const normal = execFileSync(php, [file], { encoding: 'utf8' });
    const preview = execFileSync(php, ['-r', "$_GET['preview']='1';require $argv[1];", file], { encoding: 'utf8' });
    assert.doesNotMatch(normal, /FOR VIEWING ONLY|assets\/js\/event-preview.js/);
    assert.match(preview, /FOR VIEWING ONLY/);
    assert.match(preview, /assets\/js\/event-preview.js\?v=\d+/);
    assert.match(preview, /assets\/css\/event-preview.css\?v=\d+/);
    const organizer = fs.readFileSync(path.join(root, 'organizer/event-detail.php'), 'utf8');
    assert.match(organizer, /encodeURIComponent\(eventId\)\}&preview=1/);
});
