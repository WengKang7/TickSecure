/* Render saved photos from the existing auth/profile state; no extra reads. */
(() => {
    'use strict';
    const defaultPhoto = new URL('../images/profile-placeholder.svg', document.currentScript.src).href;
    function render() {
        const profile = window.tsCurrentUser;
        const name = String(profile?.fullName || profile?.email || 'User');
        const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'U';
        let photo = '';
        try {
            const url = new URL(profile?.profilePhotoUrl || profile?.photoURL || window.tsFirebase?.auth?.currentUser?.photoURL);
            if (profile?.uid && url.protocol === 'https:' && !url.username && !url.password) photo = url.href;
        } catch (_) { /* Initials remain the fallback for missing/invalid images. */ }
        ['header-avatar', 'sidebar-avatar', 'profile-photo-avatar'].forEach(id => {
            const avatar = document.getElementById(id);
            if (!avatar) return;
            let img = avatar.querySelector('img');
            let label = avatar.querySelector('span');
            if (!img || !label) {
                img = document.createElement('img');
                label = document.createElement('span');
                avatar.replaceChildren(img, label);
            }
            img.classList.add('ts-profile-avatar-image');
            img.alt = '';
            label.textContent = initials;
            label.hidden = false;
            label.style.display = '';
            img.style.display = 'none';
            avatar.classList.toggle('ts-has-profile-photo', !!photo);
            img.onload = () => { img.style.display = 'block'; label.hidden = true; };
            img.onerror = () => {
                if (id === 'header-avatar' && img.src !== defaultPhoto) {
                    // Broken or expired photos fall back to a bundled image.
                    // Never retry that fallback recursively if it also fails.
                    img.src = defaultPhoto;
                    return;
                }
                img.style.display = 'none';
                label.hidden = false;
                avatar.classList.remove('ts-has-profile-photo');
            };
            if (photo) img.src = photo;
            else if (id === 'header-avatar') img.src = defaultPhoto;
            else img.removeAttribute('src');
        });
    }
    window.addEventListener('ts-auth-ready', render);
    window.addEventListener('ts-profile-updated', render);
    render();
})();
