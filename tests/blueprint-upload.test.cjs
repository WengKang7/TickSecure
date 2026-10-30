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
    const elements = new Map(['real-blueprint-file', 'upload-error', 'upload-status', 'save-layout-draft', 'confirm-sections', 'activate-layout', 'blueprint-filename', 'blueprint-size', 'manual-blueprint-review'].map(id => [id, {
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
        tsBlueprintOCR: { scan: async file => {
            if (options.ocrError) throw Error(options.ocrError);
            return { sections: [{ sectionId: 'SCANNED', name: 'Scanned section', seatCount: 0, geometry: { layout: 'ocr' } }],
                analysis: { sourceName: file.name, sourceSize: file.size, status: 'NEEDS_REVIEW' } };
        } },
        tsVenues: {
            saveBlueprintAnalysis: async (...args) => { if (options.saveError) throw Error(options.saveError); writes.push(['analysis', ...args]); },
            failBlueprintAnalysis: async (...args) => writes.push(['failed', ...args]),
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

test('small PNG uploads reach review without PDF parsing and cache the correct file type', async () => {
    const p = await blueprintPage();
    let pdfCalls = 0;
    p.window['pdfjs-dist/build/pdf'] = { GlobalWorkerOptions: {}, getDocument() { pdfCalls++; throw Error('PNG must not reach PDF.js'); } };
    p.input.files = [{ name: 'layout.png', type: 'image/png', size: 56743, arrayBuffer: async () => new ArrayBuffer(1) }];
    await p.change();
    assert.equal(p.calls, 1);
    assert.equal(pdfCalls, 0);
    assert.equal(p.cache.get('blueprint_type_venue-1'), 'image/png');
    assert.match(p.window.location.href, /step=3/);
});

test('unsupported, empty, and oversized PNG files are rejected before upload', async () => {
    for (const [type, size, message] of [['image/jpeg', 100, /PNG image or PDF/], ['image/png', 0, /empty/], ['image/png', 11 * 1024 * 1024, /10 MB/]]) {
        const p = await blueprintPage();
        p.input.files = [{ name: 'layout.png', type, size }];
        await p.change();
        assert.equal(p.calls, 0);
        assert.match(p.elements.get('upload-error').textContent, message);
    }
});

test('PNG blueprint metadata renders as PNG on reload', async () => {
    const p = await blueprintPage({ step: 3, venue: { name: 'Venue', sections: [], blueprintName: 'layout.png', blueprintSize: 56743, blueprintMimeType: 'image/png' } });
    assert.match(p.elements.get('blueprint-size').textContent, /^PNG/);
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

test('successful uploads persist OCR sections before navigating, without caching the full PDF', async () => {
    const p = await blueprintPage();
    await p.change();
    assert.equal(p.calls, 1);
    assert.equal(p.window.location.href, 'venue-layout.php?id=venue-1&step=3');
    assert.equal(p.cache.has('mock_pdf_count_venue-1'), false);
    assert.equal(p.writes[0][0], 'analysis');
    assert.equal(p.writes[0][2].sections[0].sectionId, 'SCANNED');
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

test('OCR failure reports the saved upload, offers manual review and never navigates with sample sections', async () => {
    const p = await blueprintPage({ ocrError: 'No readable labels found' });
    await p.change();
    assert.equal(p.calls, 1);
    assert.equal(p.window.location.href, 'initial');
    assert.match(p.elements.get('upload-error').textContent, /File uploaded, but OCR did not complete.*No readable labels/);
    assert.equal(p.writes[0][0], 'failed');
    assert.equal(p.elements.get('manual-blueprint-review').hidden, false);
    assert.match(p.elements.get('manual-blueprint-review').href, /step=3/);
    assert.equal(p.cache.has('mock_pdf_count_venue-1'), false);
});

test('OCR result persistence must succeed before the upload flow advances', async () => {
    const p = await blueprintPage({ saveError: 'Firestore unavailable' });
    await p.change();
    assert.equal(p.window.location.href, 'initial');
    assert.match(p.elements.get('upload-error').textContent, /Firestore unavailable/);
});

test('section review and activation both stop on Cancel and save only after confirmation', async () => {
    const venue = { name: 'Test venue', capacity: 20, layoutStatus: 'DRAFT', sections: [{ sectionId: 'A', name: 'Section A', seatCount: 20 }] };
    for (const [id, action, kind, next, step] of [
        ['confirm-sections', 'confirmSections', 'sections', 'step=5', 3],
        ['activate-layout', 'activateLayout', 'activate', 'activated=1', 5]
    ]) {
        const cancelled = await blueprintPage({ venue, confirm: false, step });
        await cancelled.click(id);
        assert.deepEqual(cancelled.writes, []);
        assert.equal(cancelled.window.location.href, 'initial');
        assert.equal(cancelled.decisions[0][0], action);
        const confirmed = await blueprintPage({ venue, step });
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

test('local PNG uploads retain the original PNG bytes and content type', async () => {
    const c = localUploadClient();
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64');
    const file = new File([bytes], 'layout.png', { type: 'image/png' });
    await c.context.uploadLocalBlueprint('venue-1', file);
    const uploaded = c.requests[0].body.get('file');
    assert.equal(uploaded.type, 'image/png');
    assert.equal(uploaded.name, 'layout.png');
    assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), bytes);
});

test('PHP validates PNG and PDF contents, rejects disguised files, and resolves private PNG paths', () => {
    const { execFileSync } = require('node:child_process');
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
    const output = execFileSync(php, ['-r', `
        require $argv[1];
        $tmp = tempnam(sys_get_temp_dir(), 'blueprint-policy-');
        $results = [];
        try {
            foreach ([base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='),
                '%PDF-1.4' . chr(10) . '%%EOF', '<?php echo "not a PNG";',
                base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='),
                hex2bin('89504e470d0a1a0a')] as $content) {
                file_put_contents($tmp, $content);
                try { $results[] = blueprint_inspect_file($tmp, strlen($content)); }
                catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
            }
            $results[] = basename(blueprint_file_path(str_repeat('a', 40) . '.png'));
        } finally { unlink($tmp); }
        echo json_encode($results);
    `, path.join(root, 'api/venue-blueprint-policy.php')], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), ['image/png', 'application/pdf', 415, 415, 415, 'a'.repeat(40) + '.png']);
});

test('the venue service accepts PNG and PDF on Firebase Storage and retains their MIME metadata', async () => {
    const crud = fs.readFileSync(path.join(root, 'assets/js/firestore-crud.js'), 'utf8');
    const source = crud.slice(crud.indexOf('export const VenueService ='), crud.indexOf('export const EventService ='))
        .replace('export const VenueService =', 'globalThis.venue =');
    const uploads = [], writes = [];
    const context = vm.createContext({
        useLocalBlueprintUpload: () => false,
        uploadFile: async (...args) => { uploads.push(args); return { url: 'https://storage.example/blueprint' }; },
        updateDoc: async (...args) => writes.push(args), doc: () => 'venue-ref', db: {}, iso: () => 'now', crypto: require('node:crypto').webcrypto
    });
    vm.runInContext(source, context);
    context.venue.getVenue = async () => ({ layoutStatus: 'DRAFT' });
    for (const type of ['image/png', 'application/pdf']) {
        await context.venue.uploadBlueprint('venue', { name: 'blueprint', size: 100, type, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
        assert.deepEqual(Array.from(uploads.at(-1)[2]), ['image/png', 'application/pdf']);
        assert.equal(writes.at(-1)[1].blueprintMimeType, type);
    }
    await assert.rejects(context.venue.uploadBlueprint('venue', { name: 'bad.jpg', size: 100, type: 'image/jpeg' }), /PNG or PDF/);
    assert.equal(uploads.length, 2);
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
        try { blueprint_inspect_file(__FILE__, BLUEPRINT_MAX_BYTES + 1); $results[] = 200; }
        catch (FirebaseBackendException $e) { $results[] = $e->httpStatus; }
        $tmp = tempnam(sys_get_temp_dir(), 'blueprint-policy-');
        try {
            file_put_contents($tmp, '<?php echo "disguised as a PDF";');
            try { blueprint_inspect_file($tmp, filesize($tmp)); $results[] = 200; }
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
