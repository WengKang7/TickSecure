const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function storageUpload(options = {}) {
    const timers = new Map();
    let nextTimer = 0;
    let observer;
    let cancels = 0;
    const task = {
        snapshot: { ref: 'uploaded-file' },
        on(type, progress, error, complete) { observer = { progress, error, complete }; },
        cancel() { cancels++; observer.error({ code: 'storage/canceled' }); }
    };
    const context = vm.createContext({
        uploadBytesResumable: () => task,
        getDownloadURL: options.getDownloadURL || (async () => 'https://storage.example/blueprint.pdf'),
        setTimeout(callback, milliseconds) { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    const source = fs.readFileSync(path.join(root, 'assets/js/storage-upload.js'), 'utf8')
        .replace(/^import .*\r?\n/, '').replace('export function', 'function');
    vm.runInContext(source, context);
    return {
        start: status => context.uploadToStorage('file-ref', { type: 'application/pdf' }, status),
        get observer() { return observer; },
        get cancels() { return cancels; },
        timers,
        expire(milliseconds) {
            const entry = [...timers].find(([, timer]) => timer.milliseconds === milliseconds);
            assert.ok(entry, `Expected a ${milliseconds}ms timeout`);
            timers.delete(entry[0]);
            entry[1].callback();
        }
    };
}

test('storage upload reports actual bytes and resolves only after the file URL is available', async () => {
    const s = storageUpload();
    const status = [];
    const result = s.start(message => status.push(message));
    s.observer.progress({ bytesTransferred: 25, totalBytes: 100 });
    assert.match(status[0], /25%/);
    s.observer.complete();
    assert.equal(await result, 'https://storage.example/blueprint.pdf');
    assert.equal(s.timers.size, 0);
    assert.equal(s.cancels, 0);
});

test('a stalled upload is canceled after 30 seconds and late completion cannot succeed', async () => {
    const s = storageUpload();
    const result = s.start();
    s.observer.progress({ bytesTransferred: 0, totalBytes: 100 });
    const idle = [...s.timers.keys()].at(-1);
    s.observer.progress({ bytesTransferred: 0, totalBytes: 100 });
    assert.ok(s.timers.has(idle), 'Retry events without new bytes must not extend the timeout');
    s.expire(30000);
    await assert.rejects(result, /Upload timed out/);
    s.observer.complete();
    assert.equal(s.cancels, 1);
    assert.equal(s.timers.size, 0);
});

test('a continuously progressing upload still has a two minute overall limit', async () => {
    const s = storageUpload();
    const result = s.start();
    s.observer.progress({ bytesTransferred: 50, totalBytes: 100 });
    s.expire(120000);
    await assert.rejects(result, /Upload timed out/);
    assert.equal(s.cancels, 1);
});

test('a hanging file URL lookup is bounded too', async () => {
    const s = storageUpload({ getDownloadURL: () => new Promise(() => {}) });
    const result = s.start();
    s.observer.complete();
    s.expire(30000);
    await assert.rejects(result, /Upload timed out/);
    assert.equal(s.timers.size, 0);
});

test('storage permission failures show an actionable error and clear timers', async () => {
    const s = storageUpload();
    const result = s.start();
    s.observer.error({ code: 'storage/unauthorized' });
    await assert.rejects(result, /administrator account and deployed Storage rules/);
    assert.equal(s.timers.size, 0);
});

async function blueprintPage(options = {}) {
    const elements = new Map(['real-blueprint-file', 'upload-error', 'upload-status', 'save-layout-draft', 'confirm-sections', 'activate-layout'].map(id => [id, {
        style: {}, value: 'selected.pdf', disabled: false, listeners: {},
        addEventListener(type, callback) { this.listeners[type] = callback; }
    }]));
    let ready;
    let calls = 0;
    const decisions = [], writes = [];
    const cache = new Map();
    const window = {
        location: { search: '?id=venue-1&step=' + (options.step || 1), href: 'initial' },
        addEventListener(type, callback) { ready = callback; },
        tsAdminConfirm: async (...args) => { decisions.push(args); return options.confirm === false ? null : {}; },
        tsVenues: {
            getVenue: async () => options.venue || ({ name: 'Test venue', sections: [] }),
            uploadBlueprint: async (...args) => { calls++; return options.upload?.(...args); },
            updateSections: async (...args) => writes.push(['sections', ...args]),
            activateLayout: async (...args) => writes.push(['activate', ...args])
        }
    };
    const source = fs.readFileSync(path.join(root, 'admin/venue-layout.php'), 'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    vm.runInNewContext(source, {
        window, document: { getElementById: id => elements.get(id), querySelector: selector => ({
            'a[href="venue-layout.php?step=4"]': elements.get('confirm-sections'), '#step5-activate-btn': elements.get('activate-layout')
        })[selector] || null },
        sessionStorage: { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) },
        URLSearchParams, setTimeout, clearTimeout, console: { warn() {}, error() {} }
    });
    await ready();
    const input = elements.get('real-blueprint-file');
    input.files = [{ name: 'layout.pdf', type: 'application/pdf', size: options.size ?? 100 }];
    return { elements, window, input, cache, decisions, writes, get calls() { return calls; }, change: () => input.listeners.change({ target: input }),
        click: id => elements.get(id).listeners.click({ preventDefault() {} }) };
}

test('oversized PDFs are rejected before upload or PDF analysis', async () => {
    const p = await blueprintPage({ size: 11 * 1024 * 1024 });
    await p.change();
    assert.equal(p.calls, 0);
    assert.match(p.elements.get('upload-error').textContent, /10 MB/);
    assert.equal(p.elements.get('upload-error').style.display, 'block');
});

test('failed uploads release the input, show the error, and allow the same PDF to be retried', async () => {
    const p = await blueprintPage({ upload: async () => { throw Error('Storage denied this upload'); } });
    await p.change();
    assert.equal(p.input.disabled, false);
    assert.equal(p.input.value, '');
    assert.equal(p.elements.get('upload-status').style.display, 'none');
    assert.match(p.elements.get('upload-error').textContent, /Storage denied/);
    assert.equal(p.window.location.href, 'initial');
    await p.change();
    assert.equal(p.calls, 2);
});

test('successful uploads reach review even if PDF analysis is unavailable, without caching the full PDF', async () => {
    const p = await blueprintPage();
    await p.change();
    assert.equal(p.calls, 1);
    assert.equal(p.window.location.href, 'venue-layout.php?id=venue-1&step=3');
    assert.equal(p.cache.get('mock_pdf_count_venue-1'), 4);
    assert.equal(p.cache.has('mock_pdf_venue-1'), false);
    assert.equal(p.decisions.length, 0, 'an initial draft upload does not need an extra confirmation');
});

test('replacing an existing PDF requires confirmation and Cancel keeps the current blueprint', async () => {
    const venue = { name: 'Test venue', sections: [], blueprintUrl: 'current.pdf', blueprintName: 'current.pdf' };
    const cancelled = await blueprintPage({ venue, confirm: false });
    await cancelled.change();
    assert.equal(cancelled.calls, 0);
    assert.equal(cancelled.window.location.href, 'initial');
    assert.equal(cancelled.decisions[0][0], 'replaceBlueprint');
    const confirmed = await blueprintPage({ venue });
    await confirmed.change();
    assert.equal(confirmed.calls, 1);
    assert.match(confirmed.window.location.href, /step=3/);
});

test('section confirmation and layout activation stop before persistence or navigation on Cancel', async () => {
    const venue = { name: 'Test venue', capacity: 20, layoutStatus: 'DRAFT', sections: [{ sectionId: 'A', name: 'Section A', seatCount: 20 }] };
    for (const [id, action, kind, next] of [['confirm-sections', 'confirmSections', 'sections', 'step=4'], ['activate-layout', 'activateLayout', 'activate', 'activated=1']]) {
        const cancelled = await blueprintPage({ venue, confirm: false, step: 5 });
        await cancelled.click(id);
        assert.deepEqual(cancelled.writes, []);
        assert.equal(cancelled.window.location.href, 'initial');
        assert.equal(cancelled.decisions[0][0], action);
        const confirmed = await blueprintPage({ venue, step: 5 });
        await confirmed.click(id);
        assert.equal(confirmed.writes[0][0], kind);
        assert.equal(confirmed.writes[0][1], 'venue-1');
        assert.ok(confirmed.window.location.href.includes(next));
    }
});

function localUploadClient(options = {}) {
    const requests = [];
    const window = {
        location: { hostname: options.hostname || 'localhost' },
        tsFirebase: { emulator: { enabled: options.emulator || false }, backend: { projectUrl: 'http://localhost/ticksecure-ui/' } }
    };
    const context = vm.createContext({
        window, auth: { currentUser: options.guest ? null : { getIdToken: async () => 'firebase-id-token' } },
        URL, FormData, AbortController, setTimeout, clearTimeout,
        fetch: async (url, request) => {
            requests.push({ url, ...request });
            return { ok: !options.error, json: async () => options.error
                ? { error: options.error } : { ok: true, url: 'api/venue-blueprint.php?venueId=venue-1' } };
        }
    });
    const source = fs.readFileSync(path.join(root, 'assets/js/blueprint-upload.js'), 'utf8')
        .replace(/^import .*\r?\n/, '').replaceAll('export ', '');
    vm.runInContext(source, context);
    return { requests, context, window };
}

test('only loopback venue uploads use local PHP; remote and emulator sessions retain Firebase Storage', () => {
    for (const hostname of ['localhost', '127.0.0.1', '::1', '[::1]']) {
        assert.equal(localUploadClient({ hostname }).context.useLocalBlueprintUpload(), true);
    }
    assert.equal(localUploadClient({ hostname: 'tickets.example.com' }).context.useLocalBlueprintUpload(), false);
    assert.equal(localUploadClient({ emulator: true }).context.useLocalBlueprintUpload(), false);
});

test('local blueprint upload sends the Firebase token and original PDF, without a shared upload secret', async () => {
    const c = localUploadClient();
    const file = new File(['%PDF-1.4\n%%EOF'], 'layout.pdf', { type: 'application/pdf' });
    const url = await c.context.uploadLocalBlueprint('venue-1', file);
    assert.equal(url, 'http://localhost/ticksecure-ui/api/venue-blueprint.php?venueId=venue-1');
    assert.equal(c.requests[0].headers.Authorization, 'Bearer firebase-id-token');
    assert.equal(c.requests[0].body.get('venueId'), 'venue-1');
    assert.equal(c.requests[0].body.get('file').name, 'layout.pdf');
    assert.equal(c.requests[0].headers['X-TickSecure-Local-Upload-Token'], undefined);
});

test('guest uploads cannot reach PHP and server authorization failures remain visible', async () => {
    const guest = localUploadClient({ guest: true });
    await assert.rejects(guest.context.uploadLocalBlueprint('venue-1', {}), /Sign in/);
    assert.equal(guest.requests.length, 0);
    const denied = localUploadClient({ error: 'Only an active administrator can upload or read blueprints.' });
    await assert.rejects(denied.context.uploadLocalBlueprint('venue-1', new File(['PDF'], 'layout.pdf')), /administrator/);
});

test('PHP blueprint policy accepts provisioned admins and denies missing identity, non-admins, traversal, and disguised PDFs', () => {
    const { execFileSync } = require('node:child_process');
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const output = execFileSync(php, ['-r', `
        require $argv[1];
        $claims = ['sub' => 'admin-1', 'email_verified' => true];
        $profile = ['role' => 'admin', 'status' => 'active', 'emailVerified' => true];
        $results = [];
        foreach ([[$claims, $profile], [$claims, null], [$claims, array_replace($profile, ['role'=>'buyer'])],
            [$claims, array_replace($profile, ['status'=>'suspended'])],
            [array_replace($claims, ['email_verified'=>false]), $profile],
            [$claims, array_replace($profile, ['emailVerified'=>false])],
            [array_replace($claims, ['email_verified'=>false]), ['role'=>'admin', 'status'=>'active']],
            [[], $profile], [$claims, ['role'=>'admin']],
            [$claims, ['role'=>'organizer', 'status'=>'active']]] as [$claim, $actor]) {
            try { blueprint_require_admin($claim, $actor); $results[] = 200; }
            catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        }
        try { blueprint_require_venue_id('../venue'); $results[] = 200; }
        catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        try { blueprint_file_path('../private.pdf'); $results[] = 200; }
        catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        try { blueprint_inspect_pdf(__FILE__, BLUEPRINT_MAX_BYTES + 1); $results[] = 200; }
        catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        $tmp = tempnam(sys_get_temp_dir(), 'blueprint-policy-');
        try {
            file_put_contents($tmp, '<?php echo "disguised as a PDF";');
            try { blueprint_inspect_pdf($tmp, filesize($tmp)); $results[] = 200; }
            catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        } finally { unlink($tmp); }
        $results[] = blueprint_is_loopback('127.0.0.1');
        $results[] = blueprint_is_loopback('192.168.1.1');
        echo json_encode($results);
    `, path.join(root, 'api/venue-blueprint-policy.php')], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), [200, 403, 403, 403, 200, 200, 200, 401, 403, 403, 400, 404, 413, 415, true, false]);
});

test('PHP endpoint requires server opt-in, a loopback request, and a Firebase bearer token', () => {
    const { execFileSync } = require('node:child_process');
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    for (const scenario of [
        { enabled: '0', address: '127.0.0.1', method: 'POST', code: 'blueprint_upload_disabled' },
        { enabled: '1', address: '192.168.1.1', method: 'POST', code: 'blueprint_upload_disabled' },
        { enabled: '1', address: '127.0.0.1', method: 'POST', code: 'unauthenticated' },
        { enabled: '1', address: '::1', method: 'GET', code: 'unauthenticated' },
        { enabled: '1', address: '127.0.0.1', method: 'DELETE', code: 'method_not_allowed' }
    ]) {
        const output = execFileSync(php, ['-r', `
            $_SERVER['REMOTE_ADDR'] = $argv[2];
            $_SERVER['REQUEST_METHOD'] = $argv[3];
            require $argv[1];
        `, path.join(root, 'api/venue-blueprint.php'), scenario.address, scenario.method], {
            encoding: 'utf8', env: { ...process.env, TICKSECURE_PHP_BLUEPRINT_UPLOAD: scenario.enabled }
        });
        assert.equal(JSON.parse(output).code, scenario.code);
    }
});
