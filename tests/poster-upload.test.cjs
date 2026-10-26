const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');

function client(options = {}) {
    const requests = [];
    const window = { location: { hostname: options.hostname || 'localhost', origin: 'http://localhost' },
        tsFirebase: { emulator: { enabled: options.emulator || false }, backend: { projectUrl: 'http://localhost/ticksecure-ui/' } } };
    const timers = new Map();
    let next = 0;
    const context = vm.createContext({ window, URL, FormData, AbortController,
        auth: { currentUser: options.guest ? null : { getIdToken: options.getIdToken || (async () => 'signed-in-token') } },
        setTimeout: callback => { timers.set(++next, callback); return next; }, clearTimeout: id => timers.delete(id),
        fetch: async (url, request) => {
            requests.push({ url, ...request });
            return { ok: !options.error, json: async () => options.error ? { error: options.error } : { ok: true, path: options.path || 'uploads/posters/' + 'a'.repeat(40) + '.jpg' } };
        }
    });
    const source = fs.readFileSync(path.join(root, 'assets/js/poster-upload.js'), 'utf8').replace(/^import .*\r?\n/, '').replaceAll('export ', '');
    vm.runInContext(source, context);
    return { context, requests, timers };
}
const image = () => new File(['test image bytes'], 'images.jpg', { type: 'image/jpeg' });

test('poster uploads select local PHP only for localhost outside emulator mode', () => {
    assert.equal(client().context.useLocalPosterUpload(), true);
    assert.equal(client({ hostname: '127.0.0.1' }).context.useLocalPosterUpload(), true);
    assert.equal(client({ hostname: 'tickets.example.com' }).context.useLocalPosterUpload(), false);
    assert.equal(client({ emulator: true }).context.useLocalPosterUpload(), false);
});
test('local poster requests carry the event ID and Firebase token and resolve a safe public image URL', async () => {
    const c = client();
    const url = await c.context.uploadLocalPoster('event-1', image());
    assert.equal(url, 'http://localhost/ticksecure-ui/uploads/posters/' + 'a'.repeat(40) + '.jpg');
    assert.equal(c.requests[0].url, 'http://localhost/ticksecure-ui/api/event-poster.php');
    assert.equal(c.requests[0].headers.Authorization, 'Bearer signed-in-token');
    assert.equal(c.requests[0].body.get('eventId'), 'event-1');
    assert.equal(c.requests[0].body.get('file').name, 'images.jpg');
    assert.equal(c.timers.size, 0);
});
test('guest uploads, server rejection, and unsafe returned paths cannot be mistaken for success', async () => {
    const guest = client({ guest: true });
    await assert.rejects(guest.context.uploadLocalPoster('event-1', image()), /Sign in/);
    assert.equal(guest.requests.length, 0);
    await assert.rejects(client({ error: 'You can upload posters only for your own events.' }).context.uploadLocalPoster('event-1', image()), /own events/);
    await assert.rejects(client({ path: '../secrets.php' }).context.uploadLocalPoster('event-1', image()), /invalid file path/);
});
test('a timed-out token lookup never starts a late poster upload', async () => {
    let resolveToken;
    const c = client({ getIdToken: () => new Promise(resolve => { resolveToken = resolve; }) });
    const result = c.context.uploadLocalPoster('event-1', image());
    [...c.timers.values()][0]();
    await assert.rejects(result, /timed out/);
    resolveToken('late-token');
    await Promise.resolve();
    assert.equal(c.requests.length, 0);
});
test('PHP poster authorization enforces ownership, active status, organizer verification, and draft status', () => {
    const result = execFileSync(php, ['-r', `
        require $argv[1];
        $claims=['sub'=>'organizer-1','email_verified'=>true];
        $profile=['role'=>'organizer','status'=>'active'];
        $event=['organizerUid'=>'organizer-1','status'=>'DRAFT'];
        $cases=[[$claims,$profile,$event],[$claims,array_replace($profile,['role'=>'buyer']),$event],
          [$claims,array_replace($profile,['status'=>'suspended']),$event],
          [array_replace($claims,['email_verified'=>false]),$profile,$event],
          [$claims,$profile,array_replace($event,['organizerUid'=>'another'])],
          [$claims,$profile,array_replace($event,['status'=>'PUBLISHED'])],
          [$claims,$profile,null], [[], $profile,$event],
          [array_replace($claims,['email_verified'=>false]),['role'=>'admin','status'=>'active'],$event]];
        $results=[];
        foreach($cases as [$c,$p,$e]) { try{poster_require_editor($c,$p,$e);$results[]=200;}
          catch(FirebaseBackendException $e){$results[]=$e->httpStatus;} }
        try{poster_require_event_id('../event');$results[]=200;}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}
        try{poster_file_path('../unsafe.jpg');$results[]=200;}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}
        $tmp=tempnam(sys_get_temp_dir(),'poster-policy-');
        try {
          file_put_contents($tmp,'<?php echo "not an image";');
          try{poster_inspect_image($tmp,filesize($tmp));$results[]=200;}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}
          try{poster_inspect_image($tmp,POSTER_MAX_BYTES+1);$results[]=200;}catch(FirebaseBackendException $e){$results[]=$e->httpStatus;}
        } finally {unlink($tmp);}
        echo json_encode($results);
    `, path.join(root, 'api/event-poster-policy.php')], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), [200,403,403,403,403,409,404,401,200,400,400,415,413]);
});
test('the local poster endpoint retains server opt-in, loopback, HTTP-method, and authentication boundaries', () => {
    for (const [enabled, address, method, code] of [
        ['0','127.0.0.1','POST','poster_upload_disabled'], ['1','192.168.0.1','POST','poster_upload_disabled'],
        ['1','127.0.0.1','GET','method_not_allowed'], ['1','127.0.0.1','POST','unauthenticated']
    ]) {
        const output = execFileSync(php, ['-r', "$_SERVER['REMOTE_ADDR']=$argv[2];$_SERVER['REQUEST_METHOD']=$argv[3];require $argv[1];", path.join(root, 'api/event-poster.php'), address, method],
            { encoding: 'utf8', env: { ...process.env, TICKSECURE_PHP_POSTER_UPLOAD: enabled } });
        assert.equal(JSON.parse(output).code, code);
    }
});
