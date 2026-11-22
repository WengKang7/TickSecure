const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');

// Exercise the Firebase boundary without signing into a live account.
function passwordService(reauthenticate = async () => {}) {
    const auth = { currentUser: { uid: 'buyer', email: 'buyer@example.test' } }, calls = [];
    const source = fs.readFileSync('assets/js/firebase-services.js', 'utf8');
    const definition = source.slice(source.indexOf('export const AuthService'), source.indexOf('// DATABASE (FIRESTORE)'))
        .replace('export const AuthService', 'globalThis.service');
    const context = vm.createContext({ auth,
        EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
        reauthenticateWithCredential: async (user, credential) => { calls.push(['reauth', user, credential]); await reauthenticate(auth); },
        updatePassword: async (user, password) => { calls.push(['update', user, password]); }
    });
    vm.runInContext(definition, context);
    return { auth, calls, service: context.service };
}

test('password changes reauthenticate the current account before updating Firebase Auth', async () => {
    const state = passwordService();
    await state.service.changePassword('OldPassword1!', 'NewPassword2!');
    assert.deepEqual(state.calls.map(call => call[0]), ['reauth', 'update']);
    assert.equal(state.calls[0][2].email, 'buyer@example.test');
    assert.equal(state.calls[0][2].password, 'OldPassword1!');
    assert.equal(state.calls[1][1], state.auth.currentUser);
    assert.equal(state.calls[1][2], 'NewPassword2!');
});

test('wrong current passwords, sign-out and account changes cannot update a password', async () => {
    const wrong = passwordService(async () => { throw Object.assign(new Error('wrong'), { code: 'auth/wrong-password' }); });
    await assert.rejects(wrong.service.changePassword('wrong', 'NewPassword2!'), { code: 'auth/wrong-password' });
    assert.equal(wrong.calls.length, 1);
    const changed = passwordService(async auth => { auth.currentUser = { uid: 'other' }; });
    await assert.rejects(changed.service.changePassword('old', 'NewPassword2!'), /sign-in changed/);
    assert.equal(changed.calls.length, 1);
    const guest = passwordService(); guest.auth.currentUser = null;
    await assert.rejects(guest.service.changePassword('old', 'NewPassword2!'), /Sign in/);
    assert.equal(guest.calls.length, 0);
});

class Element {
    constructor(id) { this.id = id; this.value = ''; this.files = []; this.hidden = true; this.disabled = false; this.attributes = {}; this.handlers = {}; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    focus() { this.focused = true; }
    fire(name) { return this.handlers[name]?.({ preventDefault() {} }); }
}

function profileUI(options = {}) {
    const ids = ['profile-password-form', 'profile-photo-file', 'profile-photo-upload', 'profile-password-save',
        'profile-photo-error', 'profile-security-status', ...['current', 'new', 'confirm'].flatMap(n => [`profile-${n}-password`, `profile-${n}-error`])];
    const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
    const events = {}, requests = [], passwords = [], toasts = [], timers = new Map();
    let nextTimer = 0;
    const user = { uid: 'buyer', getIdToken: options.token || (async () => 'verified-token') };
    const window = {
        tsCurrentUser: { uid: user.uid, fullName: 'Buyer' }, tsFirebase: { auth: { currentUser: user } },
        tsAuth: { changePassword: async (...args) => { passwords.push(args); await options.password?.(); } },
        tsUsers: { setProfilePhotoCache: url => { window.cachedPhoto = url; } },
        tsShowToast: (...args) => toasts.push(args),
        addEventListener: (name, callback) => { events[name] = callback; },
        dispatchEvent: event => events[event.type]?.(event)
    };
    const context = vm.createContext({ window, URL, FormData, AbortController,
        CustomEvent: class { constructor(type, data) { this.type = type; Object.assign(this, data); } },
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id),
        document: { currentScript: { src: 'https://ticksecure.onrender.com/assets/js/profile-security.js?v=123' }, getElementById: id => elements[id] },
        fetch: async (url, request) => {
            requests.push({ url, ...request });
            return options.fetch ? options.fetch() : { ok: true, json: async () => ({ data: { profilePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/photo.png' } }) };
        }
    });
    vm.runInContext(fs.readFileSync('assets/js/validation.js', 'utf8').replace(/\bexport /g, ''), context);
    vm.runInContext(fs.readFileSync('assets/js/profile-security.js', 'utf8'), context);
    const input = (name, value) => { elements[`profile-${name}-password`].value = value; };
    const submit = () => elements['profile-password-form'].fire('submit');
    const upload = file => { elements['profile-photo-file'].files = [file]; elements['profile-photo-file'].fire('change'); return elements['profile-photo-upload'].fire('click'); };
    return { elements, events, window, user, requests, passwords, toasts, timers, input, submit, upload };
}

test('the shared form rejects mismatches, weak and unchanged passwords without contacting Auth', async () => {
    for (const [current, next, confirmation, errorField] of [
        ['', 'NewPassword2!', 'NewPassword2!', 'current'], ['OldPassword1!', 'weak', 'weak', 'new'],
        ['OldPassword1!', 'NewPassword2!', 'different', 'confirm'], ['OldPassword1!', 'OldPassword1!', 'OldPassword1!', 'new']
    ]) {
        const ui = profileUI();
        ui.input('current', current); ui.input('new', next); ui.input('confirm', confirmation);
        await ui.submit();
        assert.equal(ui.passwords.length, 0);
        assert.equal(ui.elements[`profile-${errorField}-error`].hidden, false);
    }
});

test('password submission prevents duplicate changes, clears credentials and displays success', async () => {
    let finish;
    const ui = profileUI({ password: () => new Promise(resolve => { finish = resolve; }) });
    ui.input('current', 'OldPassword1!'); ui.input('new', 'NewPassword2!'); ui.input('confirm', 'NewPassword2!');
    const pending = ui.submit(); await ui.submit();
    assert.equal(ui.passwords.length, 1);
    assert.equal(ui.elements['profile-password-save'].disabled, true);
    finish(); await pending;
    assert.equal(ui.elements['profile-password-save'].disabled, false);
    for (const n of ['current', 'new', 'confirm']) assert.equal(ui.elements[`profile-${n}-password`].value, '');
    assert.match(ui.toasts[0][0], /Password changed/);
});

test('wrong current password remains an inline field error and permits a corrected retry', async () => {
    const ui = profileUI({ password: async () => { throw Object.assign(new Error(), { code: 'auth/invalid-credential' }); } });
    ui.input('current', 'WrongPassword1!'); ui.input('new', 'NewPassword2!'); ui.input('confirm', 'NewPassword2!');
    await ui.submit();
    assert.match(ui.elements['profile-current-error'].textContent, /incorrect/);
    assert.equal(ui.elements['profile-password-save'].disabled, false);
    assert.equal(ui.toasts.length, 0);
});

test('profile photos use authenticated multipart upload, update state without another read and reject invalid files', async () => {
    const ui = profileUI();
    await ui.upload(new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }));
    assert.equal(ui.requests.length, 0);
    assert.match(ui.elements['profile-photo-error'].textContent, /JPG or PNG/);
    await ui.upload(new File(['png-bytes'], 'photo.png', { type: 'image/png' }));
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.requests[0].url, 'https://ticksecure.onrender.com/api/profile-photo.php');
    assert.equal(ui.requests[0].headers.Authorization, 'Bearer verified-token');
    assert.equal(ui.requests[0].body.get('file').name, 'photo.png');
    assert.equal(ui.requests[0].body.get('uid'), null);
    assert.equal(ui.window.cachedPhoto, ui.window.tsCurrentUser.profilePhotoUrl);
    assert.equal(ui.timers.size, 0);
});

test('server rejection preserves the old photo and restores upload controls', async () => {
    const ui = profileUI({ fetch: async () => ({ ok: false, json: async () => ({ error: { message: 'Choose a smaller photo.' } }) }) });
    ui.window.tsCurrentUser.profilePhotoUrl = 'https://res.cloudinary.com/demo/image/upload/old.png';
    await ui.upload(new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' }));
    assert.match(ui.elements['profile-photo-error'].textContent, /smaller/);
    assert.match(ui.window.tsCurrentUser.profilePhotoUrl, /old.png/);
    assert.equal(ui.elements['profile-photo-upload'].disabled, false);
});

test('a timed-out token or session switch never starts a late upload', async () => {
    for (const scenario of ['timeout', 'switch']) {
        let finish;
        const ui = profileUI({ token: () => new Promise(resolve => { finish = resolve; }) });
        const pending = ui.upload(new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' }));
        if (scenario === 'timeout') [...ui.timers.values()][0]();
        else {
            ui.window.tsFirebase.auth.currentUser = { uid: 'other' };
            ui.window.tsCurrentUser = { uid: 'other' };
            ui.events['ts-auth-ready']();
        }
        await pending;
        finish('late-token'); await Promise.resolve(); await Promise.resolve();
        assert.equal(ui.requests.length, 0);
        assert.equal(ui.window.cachedPhoto, undefined);
        assert.equal(ui.timers.size, 0);
    }
});

test('avatars show the saved photo, preserve header hooks, recover from broken images and clear on sign-out', () => {
    class AvatarElement {
        constructor(tag = 'div') {
            this.tag = tag; this.style = {}; this.children = []; this.hidden = false;
            const classes = new Set();
            this.classList = { add: name => classes.add(name), remove: name => classes.delete(name),
                toggle: (name, present) => present ? classes.add(name) : classes.delete(name) };
        }
        querySelector(tag) { return this.children.find(child => child.tag === tag); }
        replaceChildren(...children) { this.children = children; }
        removeAttribute(name) { delete this[name]; }
    }
    const header = new AvatarElement();
    const existingImage = new AvatarElement('img'), existingLabel = new AvatarElement('span');
    existingImage.id = 'header-avatar-img'; existingLabel.id = 'header-avatar-initials';
    existingLabel.style.display = 'none';
    header.replaceChildren(existingImage, existingLabel);
    const avatars = { 'header-avatar': header, 'sidebar-avatar': new AvatarElement(), 'profile-photo-avatar': new AvatarElement() };
    const events = {}, window = { tsCurrentUser: { uid: 'buyer', fullName: 'Buyer One', profilePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/one.png' },
        addEventListener: (type, callback) => { events[type] = callback; } };
    vm.runInNewContext(fs.readFileSync('assets/js/profile-avatar.js', 'utf8'), { window, URL,
        document: { currentScript: { src: 'https://ticksecure.onrender.com/assets/js/profile-avatar.js?v=123' },
            getElementById: id => avatars[id], createElement: tag => new AvatarElement(tag) } });
    assert.equal(header.querySelector('img'), existingImage);
    for (const [id, avatar] of Object.entries(avatars)) {
        const img = avatar.querySelector('img'), label = avatar.querySelector('span');
        assert.match(img.src, /one.png$/); img.onload();
        assert.equal(label.hidden, true);
        img.onerror();
        if (id === 'header-avatar') {
            assert.equal(img.src, 'https://ticksecure.onrender.com/assets/images/profile-placeholder.svg');
            img.onload(); assert.equal(label.hidden, true);
            img.onerror(); // A broken fallback must stop retrying.
            assert.equal(img.style.display, 'none');
        }
        assert.equal(label.hidden, false); assert.equal(label.style.display, '');
        assert.equal(label.textContent, 'BO');
    }
    window.tsCurrentUser = null; events['ts-auth-ready']();
    for (const [id, avatar] of Object.entries(avatars)) {
        if (id === 'header-avatar') {
            assert.equal(avatar.querySelector('img').src, 'https://ticksecure.onrender.com/assets/images/profile-placeholder.svg');
            avatar.querySelector('img').onload();
            assert.equal(avatar.querySelector('span').hidden, true);
        } else {
            assert.equal(avatar.querySelector('img').src, undefined);
            assert.equal(avatar.querySelector('span').hidden, false);
        }
    }
});

test('the PHP endpoint rejects unsupported methods and missing tokens before accessing services', () => {
    for (const [method, code] of [['GET', 'method-not-allowed'], ['POST', 'unauthenticated']]) {
        const raw = execFileSync(php, ['-r', "$_SERVER['REQUEST_METHOD']=$argv[1];require 'api/profile-photo.php';", method], { encoding: 'utf8' });
        assert.equal(JSON.parse(raw).error.code, code);
    }
});

test('server photo policy enforces account status, file content, rate limits and owner-only writes', () => {
    const raw = execFileSync(php, ['-r', `
        require 'api/profile-photo-service.php';
        class PhotoDB {
            public array $records = []; public array $writes = [];
            function transaction($callback) { $before=$this->records; try { return $callback($this); } catch(Throwable $e) { $this->records=$before; throw $e; } }
            function get($collection,$id) { return $this->records[$collection.'/'.$id]??null; }
            function create($collection,$id,$fields) { $this->records[$collection.'/'.$id]=$fields; }
            function update($collection,$id,$fields) { $this->writes[]=$collection.'/'.$id; $this->records[$collection.'/'.$id]=array_replace($this->records[$collection.'/'.$id],$fields); }
        }
        $tmp=tempnam(sys_get_temp_dir(),'profile-photo-'); $results=[];
        $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kVQAAAAASUVORK5CYII=');
        try {
            foreach(['buyer','organizer','admin'] as $role) {
                $db=new PhotoDB();$db->records=['Users/me'=>['role'=>$role,'status'=>'active','fullName'=>'Keep this'], 'Users/other'=>['role'=>'admin','status'=>'active']];
                file_put_contents($tmp,$png); $uploads=[];
                $store=function($path,$id,$image,$scope)use(&$uploads){$uploads[]=[$id,$image['mimeType'],$scope];return 'https://res.cloudinary.com/demo/image/upload/avatar.png';};
                $saved=profile_photo_save($db,['sub'=>'me'],$tmp,filesize($tmp),$store);
                $results[]=['role'=>$role,'saved'=>$saved,'me'=>$db->records['Users/me'],'other'=>$db->records['Users/other'],'uploads'=>$uploads,'writes'=>$db->writes];
            }
            $checks=[];
            foreach([['status'=>'suspended'], ['status'=>'pending','role'=>'buyer'], ['role'=>'unknown']] as $change) {
                $db=new PhotoDB();$db->records=['Users/me'=>array_replace(['role'=>'buyer','status'=>'active'],$change)];
                try { profile_photo_save($db,['sub'=>'me'],$tmp,strlen($png),$store);$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            }
            $db=new PhotoDB();$db->records=['Users/me'=>['role'=>'buyer','status'=>'active'],'ProfilePhotoLimits/me'=>['window'=>intdiv(time(),60),'count'=>5]];
            try { profile_photo_save($db,['sub'=>'me'],$tmp,strlen($png),$store);$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            try { profile_photo_save($db,[],$tmp,strlen($png),$store);$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            try { profile_photo_save($db,['sub'=>'me'],$tmp,POSTER_MAX_BYTES+1,$store);$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            file_put_contents($tmp,'<?php invalid file ?>');
            try { profile_photo_save($db,['sub'=>'me'],$tmp,22,$store);$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            file_put_contents($tmp,$png);$db=new PhotoDB();$db->records=['Users/me'=>['role'=>'buyer','status'=>'active','profilePhotoUrl'=>'old']];
            try { profile_photo_save($db,['sub'=>'me'],$tmp,strlen($png),function()use($db){$db->records['Users/me']['status']='suspended';return 'new';});$checks[]=200; }catch(FirebaseBackendException $e){$checks[]=$e->httpStatus;}
            echo json_encode(['results'=>$results,'checks'=>$checks,'afterSuspension'=>$db->records['Users/me']]);
        }finally{unlink($tmp);}
    `], { encoding: 'utf8' });
    const { results, checks, afterSuspension } = JSON.parse(raw);
    for (const result of results) {
        assert.equal(result.me.fullName, 'Keep this'); assert.equal(result.me.role, result.role);
        assert.match(result.me.profilePhotoUrl, /avatar.png$/);
        assert.equal(result.other.profilePhotoUrl, undefined);
        assert.deepEqual(result.writes, ['Users/me']);
        assert.equal(result.uploads.length, 1); assert.equal(result.uploads[0][2], 'profiles');
        assert.match(result.uploads[0][0], /^[a-f0-9]{64}$/);
    }
    assert.deepEqual(checks, [403,403,403,429,401,413,415,403]);
    assert.equal(afterSuspension.profilePhotoUrl, 'old');
});
