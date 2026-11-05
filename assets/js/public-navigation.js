(() => {
    const header = document.querySelector('.ts-public-header');
    if (!header) return;
    const root = new URL(header.dataset.appRoot + '/', window.location.href);
    const toggle = document.getElementById('public-menu-toggle');
    const panel = document.getElementById('public-mobile-panel');
    const el = id => document.getElementById(id);
    const account = el('public-account'), accountToggle = el('public-user-link'), accountMenu = el('public-account-menu');
    let buyerAccount = false;
    function closeAccount(restoreFocus = false) {
        accountMenu.hidden = true;
        if (buyerAccount) accountToggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) accountToggle.focus();
    }
    function openAccount(focusFirst = false) {
        closeMenu();
        accountMenu.hidden = false;
        accountToggle.setAttribute('aria-expanded', 'true');
        if (focusFirst) el('account-profile-link').focus();
    }
    accountToggle.addEventListener('click', event => {
        if (!buyerAccount) return;
        event.preventDefault();
        accountMenu.hidden ? openAccount() : closeAccount();
    });
    accountToggle.addEventListener('keydown', event => {
        if (!buyerAccount || ![' ', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowDown' || accountMenu.hidden) openAccount(true);
        else closeAccount();
    });
    accountMenu.addEventListener('click', event => {
        if (event.target.closest('a')) closeAccount();
    });
    accountMenu.addEventListener('focusout', event => {
        if (!account.contains(event.relatedTarget)) closeAccount();
    });
    el('account-logout-btn').addEventListener('click', () => {
        closeAccount(true);
        if (buyerAccount) el('public-logout-btn').click();
    });
    const walletHref = () => {
        const target = new URL('buyer/wallet.php', root);
        const current = new URL(window.location.href);
        if (current.pathname === new URL('buyer/checkout.php', root).pathname) {
            target.searchParams.set('redirect', 'checkout.php' + current.search);
        } else if (current.pathname !== target.pathname && current.pathname.startsWith(root.pathname)) {
            target.searchParams.set('returnTo', current.pathname + current.search);
        }
        return target.href;
    };
    function closeMenu(restoreFocus = false) {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
        if (restoreFocus) toggle.focus();
    }
    toggle.addEventListener('click', () => {
        closeAccount();
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) closeMenu(true);
        if (event.key === 'Escape' && !accountMenu.hidden) closeAccount(true);
    });
    document.addEventListener('click', event => {
        if (!panel.hidden && !header.contains(event.target)) closeMenu();
        if (!accountMenu.hidden && !account.contains(event.target)) closeAccount();
    });
    panel.addEventListener('click', event => {
        if (event.target.closest('a')) closeMenu();
    });
    window.matchMedia?.('(min-width: 1281px)').addEventListener?.('change', event => {
        closeAccount();
        if (event.matches) closeMenu();
    });
    el('mobile-logout-btn').addEventListener('click', () => el('public-logout-btn').click());
    const search = document.getElementById('event-search');
    if (search) {
        header.querySelector('.ts-header-search')?.addEventListener('click', event => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            search.focus({ preventScroll: true });
            search.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        if (window.location.hash === '#event-search') search.focus();
    }
    function update(profile) {
        const buyer = profile?.role === 'buyer';
        const staff = ['admin', 'organizer'].includes(profile?.role);
        closeAccount();
        buyerAccount = buyer;
        el('public-logout-btn').hidden = buyer;
        el('public-account-chevron').hidden = !buyer;
        if (buyer) {
            accountToggle.setAttribute('role', 'button');
            accountToggle.setAttribute('aria-label', 'Account options');
            accountToggle.setAttribute('aria-expanded', 'false');
            accountToggle.setAttribute('aria-controls', 'public-account-menu');
        } else {
            for (const attribute of ['role', 'aria-expanded', 'aria-controls']) accountToggle.removeAttribute(attribute);
            accountToggle.setAttribute('aria-label', 'My profile');
        }
        header.querySelectorAll('[data-ts-auth-only]').forEach(link => { link.hidden = !profile; });
        header.querySelectorAll('[data-ts-buyer-only]').forEach(link => { link.hidden = !buyer; });
        header.querySelectorAll('[data-ts-staff-only]').forEach(link => { link.hidden = !staff; });
        header.querySelectorAll('[data-ts-guest-only]').forEach(link => { link.hidden = Boolean(profile); });
        const wallet = String(profile?.walletAddress || '');
        const saved = /^0x[a-fA-F0-9]{40}$/.test(wallet);
        const short = saved ? wallet.slice(0, 6) + '\u2026' + wallet.slice(-4) : 'Not connected';
        const badge = el('public-wallet-mini');
        badge.style.display = buyer ? 'inline-flex' : 'none';
        badge.dataset.saved = String(saved);
        badge.href = walletHref();
        badge.title = saved ? 'Manage saved wallet: ' + wallet : 'Connect or manage your wallet';
        badge.setAttribute('aria-label', saved ? 'Manage wallet, saved address ' + wallet : 'Connect wallet');
        el('public-wallet-text').textContent = short;
        el('mobile-wallet-text').textContent = short;
        header.querySelectorAll('.ts-mobile-wallet-link').forEach(link => { link.href = badge.href; });
        const role = staff ? profile.role : 'buyer';
        el('mobile-profile-link').href = new URL(role + '/profile.php', root).href;
        header.querySelectorAll('[data-ts-staff-only]').forEach(link => { link.href = new URL(role + '/dashboard.php', root).href; });
    }
    window.addEventListener('ts-auth-ready', event => { update(event.detail); closeMenu(); });
    window.addEventListener('ts-profile-updated', event => update(event.detail));
    if (window.tsCurrentUser !== undefined) update(window.tsCurrentUser);
})();
