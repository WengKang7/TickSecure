// Independent of Firebase so SDK/network failures still leave a usable screen.
(() => {
    const appRoot = new URL('../../', document.currentScript.src);
    const status = document.createElement('section');
    status.id = 'ts-access-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = '<div class="ts-access-card"><h1 id="ts-access-title">Checking your session...</h1><p id="ts-access-message">Your account will open as soon as sign-in is confirmed.</p><div class="ts-access-actions" hidden><button type="button" class="ts-btn ts-btn-primary" id="ts-access-retry">Retry</button><a class="ts-btn ts-btn-secondary" id="ts-access-login">Sign in again</a><a class="ts-btn ts-btn-secondary" id="ts-access-home">Browse events</a></div></div>';
    document.body.appendChild(status);
    const title = status.querySelector('#ts-access-title');
    const message = status.querySelector('#ts-access-message');
    const actions = status.querySelector('.ts-access-actions');
    status.querySelector('#ts-access-retry').addEventListener('click', () => window.location.reload());
    status.querySelector('#ts-access-login').href = new URL('auth/login.php', appRoot).href;
    status.querySelector('#ts-access-home').href = new URL('public/events.php', appRoot).href;
    let timeout;
    const fail = text => {
        clearTimeout(timeout);
        title.textContent = 'Unable to open your account';
        message.textContent = text;
        actions.hidden = false;
        status.setAttribute('role', 'alert');
    };
    window.tsAccessStatus = { fail };
    const update = () => {
        clearTimeout(timeout);
        const granted = document.documentElement.getAttribute('data-ts-access') === 'granted';
        status.hidden = granted;
        if (granted) return;
        title.textContent = 'Checking your session...';
        message.textContent = 'Your account will open as soon as sign-in is confirmed.';
        actions.hidden = true;
        status.setAttribute('role', 'status');
        timeout = setTimeout(() => fail('Sign-in is taking longer than expected. Check your connection and retry, or return to sign in.'), 15000);
    };
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ts-access'] });
    update();
})();
