/* Shared profile controls for buyers, organizers and administrators. */
(() => {
    'use strict';
    const form = document.getElementById('profile-password-form');
    const fileInput = document.getElementById('profile-photo-file');
    const uploadButton = document.getElementById('profile-photo-upload');
    if (!form || !fileInput || !uploadButton) return;

    const endpoint = new URL('../../api/profile-photo.php', document.currentScript.src).href;
    const passwordButton = document.getElementById('profile-password-save');
    const fields = ['current', 'new', 'confirm'].map(name => ({
        input: document.getElementById(`profile-${name}-password`),
        error: document.getElementById(`profile-${name}-error`)
    }));
    const photoError = document.getElementById('profile-photo-error');
    let sessionUid = '', passwordBusy = false, photoBusy = false, uploadController = null;
    form.noValidate = true;

    function currentUser() {
        const user = window.tsFirebase?.auth?.currentUser;
        return user?.uid && user.uid === window.tsCurrentUser?.uid ? user : null;
    }
    function sameSession(user) { return currentUser() === user && sessionUid === user.uid; }
    function message(text, kind) {
        if (window.tsShowToast) window.tsShowToast(text, kind);
        else {
            const status = document.getElementById('profile-security-status');
            status.textContent = text;
            status.hidden = false;
        }
    }
    function fieldError(field, text = '') {
        field.error.textContent = text;
        field.error.hidden = !text;
        field.input.setAttribute('aria-invalid', String(!!text));
        field.input.setAttribute('aria-describedby', field.error.id);
    }
    function photoFeedback(text = '') {
        photoError.textContent = text;
        photoError.hidden = !text;
        fileInput.setAttribute('aria-invalid', String(!!text));
        fileInput.setAttribute('aria-describedby', photoError.id);
    }
    function syncControls() {
        const signedIn = !!currentUser();
        fields.forEach(field => { field.input.disabled = !signedIn || passwordBusy; });
        passwordButton.disabled = !signedIn || passwordBusy;
        passwordButton.textContent = passwordBusy ? 'Changing password…' : 'Change password';
        passwordButton.setAttribute('aria-busy', String(passwordBusy));
        fileInput.disabled = !signedIn || photoBusy;
        uploadButton.disabled = !signedIn || photoBusy || !fileInput.files?.length;
        uploadButton.textContent = photoBusy ? 'Uploading photo…' : 'Upload photo';
        uploadButton.setAttribute('aria-busy', String(photoBusy));
    }
    function syncSession() {
        const uid = currentUser()?.uid || '';
        if (sessionUid !== uid) {
            sessionUid = uid;
            fields.forEach(field => { field.input.value = ''; fieldError(field); });
            fileInput.value = '';
            photoFeedback();
            uploadController?.abort();
        }
        syncControls();
    }
    fields.forEach(field => field.input.addEventListener('input', () => fieldError(field)));
    fileInput.addEventListener('change', () => { photoFeedback(); syncControls(); });
    window.addEventListener('ts-auth-ready', syncSession);
    window.addEventListener('pagehide', () => {
        fields.forEach(field => { field.input.value = ''; });
        uploadController?.abort();
    });
    syncSession();

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (passwordBusy) return;
        const user = currentUser();
        if (!user || !window.tsAuth?.changePassword) return;
        fields.forEach(field => fieldError(field));
        const [current, next, confirmation] = fields.map(field => field.input.value);
        if (!current) fieldError(fields[0], 'Enter your current password.');
        const policy = window.tsValidation?.validatePassword(next);
        if (!policy?.valid) fieldError(fields[1], policy?.error || 'Enter a valid new password.');
        else if (next === current) fieldError(fields[1], 'Choose a password different from your current password.');
        if (!confirmation || confirmation !== next) fieldError(fields[2], 'New passwords do not match.');
        const invalid = fields.find(field => !field.error.hidden);
        if (invalid) { invalid.input.focus(); return; }
        passwordBusy = true;
        syncControls();
        try {
            await window.tsAuth.changePassword(current, next);
            if (!sameSession(user)) return;
            fields.forEach(field => { field.input.value = ''; });
            message('Password changed successfully. Use your new password the next time you sign in.', 'success');
        } catch (error) {
            if (!sameSession(user)) return;
            const code = error?.code;
            if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(code)) {
                fieldError(fields[0], 'Your current password is incorrect.');
            } else if (['auth/weak-password', 'auth/password-does-not-meet-requirements'].includes(code)) {
                fieldError(fields[1], 'Choose a stronger password with uppercase, lowercase, a number and a special character.');
            } else {
                message(code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes before trying again.'
                    : code === 'auth/network-request-failed' ? 'The connection was interrupted. Try signing in with your new password to check whether it changed before retrying.'
                    : 'Unable to change your password. Sign in again and retry.', 'error');
            }
        } finally {
            // Passwords never enter profile storage, URLs, or logs.
            fields[0].input.value = '';
            passwordBusy = false;
            syncControls();
        }
    });

    uploadButton.addEventListener('click', async () => {
        if (photoBusy) return;
        const user = currentUser(), file = fileInput.files?.[0];
        if (!user || !file) return;
        photoFeedback();
        if (!['image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
            photoFeedback('Choose a JPG or PNG photo up to 5 MB.');
            return;
        }
        photoBusy = true;
        syncControls();
        const controller = new AbortController();
        uploadController = controller;
        // Includes token lookup, so a delayed token cannot start a late upload.
        const timer = setTimeout(() => controller.abort(), 65000);
        let abortHandler;
        const interrupted = new Promise((_, reject) => {
            abortHandler = () => reject(new Error('upload-interrupted'));
            controller.signal.addEventListener('abort', abortHandler, { once: true });
        });
        try {
            const operation = async () => {
                const token = await user.getIdToken();
                if (controller.signal.aborted || !sameSession(user)) throw new Error('upload-interrupted');
                const body = new FormData();
                body.append('file', file);
                const response = await fetch(endpoint, {
                    method: 'POST', headers: { Authorization: `Bearer ${token}` },
                    body, signal: controller.signal, credentials: 'same-origin'
                });
                const result = await response.json();
                if (!response.ok) {
                    const error = new Error(result.error?.message || 'The photo could not be uploaded. Try again later.');
                    error.serverMessage = true;
                    throw error;
                }
                const url = new URL(result.data?.profilePhotoUrl);
                if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port) {
                    throw new Error('invalid-image-response');
                }
                return url.href;
            };
            const url = await Promise.race([operation(), interrupted]);
            if (!sameSession(user)) return;
            // Apply the confirmed server result without another database read.
            window.tsUsers?.setProfilePhotoCache?.(url);
            window.tsCurrentUser.profilePhotoUrl = url;
            window.dispatchEvent(new CustomEvent('ts-profile-updated', { detail: window.tsCurrentUser }));
            fileInput.value = '';
            message('Profile picture updated.', 'success');
        } catch (error) {
            if (!sameSession(user)) return;
            photoFeedback(error.serverMessage ? error.message
                : 'The upload could not be confirmed. Refresh your profile to check your photo before retrying.');
        } finally {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', abortHandler);
            uploadController = null;
            photoBusy = false;
            syncControls();
        }
    });
})();
