// Shared presentation only: requests, responses and action permissions stay unchanged.
(() => {
    if (window.tsLoading) return;
    const tasks = new Set(), regions = new Set();
    let timer = null, navigationTimer = null, navigating = false;
    const panel = document.createElement('div');
    panel.className = 'ts-app-loading'; panel.hidden = true;
    panel.setAttribute('data-ts-inline-feedback', '');
    panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
    const icon = document.createElement('span'); icon.className = 'ts-loading-spinner'; icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.textContent = 'Loading…';
    panel.append(icon, text); document.body.appendChild(panel);
    const selector = 'button,input[type="submit"],a[role="button"],[aria-busy]';
    const working = /^(loading|saving|uploading|processing|checking|connecting|verifying|submitting|sending|preparing|detecting|opening|minting|reserving|registering|deploying|signing|removing|exporting|refreshing)\b|please wait|waiting for (?:your |the )?(?:wallet|confirmation)|awaiting.*confirmation/i;
    const visible = node => node.isConnected && !node.hidden && !node.closest('[hidden]') && node.getClientRects().length > 0;
    const inlineBusy = () => [...document.querySelectorAll('[data-ts-inline-feedback][aria-busy="true"]')].some(visible);
    function render() {
        for (const node of regions) if (!node.isConnected || node.getAttribute('aria-busy') !== 'true' || !visible(node)) regions.delete(node);
        const active = tasks.size > 0 || regions.size > 0 || navigating;
        if (!active || document.hidden || inlineBusy()) {
            clearTimeout(timer); timer = null; panel.hidden = true; return;
        }
        if (!panel.hidden || timer !== null) return;
        timer = setTimeout(() => { timer = null; if (!document.hidden && !inlineBusy() && (tasks.size || regions.size || navigating)) panel.hidden = false; }, 180);
    }
    function begin() {
        const task = {}; tasks.add(task); render();
        let ended = false;
        return () => { if (!ended) { ended = true; tasks.delete(task); render(); } };
    }
    window.tsLoading = { begin };
    const ignoreRequest = input => {
        try {
            const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, window.location.href);
            // Streaming listeners can remain open even when a page is ready.
            return /\/(?:Listen|Write)\/channel$/.test(url.pathname)
                || /\.(?:png|jpe?g|gif|svg|webp|woff2?|ttf|wasm|onnx|task|mp4|mp3)$/i.test(url.pathname);
        } catch (_) { return false; }
    };
    if (window.fetch) {
        const original = window.fetch;
        window.fetch = function (...args) {
            if (ignoreRequest(args[0])) return original.apply(this, args);
            const end = begin();
            try { return original.apply(this, args).then(value => { end(); return value; }, error => { end(); throw error; }); }
            catch (error) { end(); throw error; }
        };
    }
    if (window.XMLHttpRequest) {
        const proto = window.XMLHttpRequest.prototype, open = proto.open, send = proto.send;
        const urls = new WeakMap();
        proto.open = function (...args) { urls.set(this, args[1]); return open.apply(this, args); };
        proto.send = function (...args) {
            if (ignoreRequest(urls.get(this))) return send.apply(this, args);
            const end = begin();
            this.addEventListener('loadend', end, {once:true});
            try { return send.apply(this, args); } catch (error) { end(); this.removeEventListener('loadend', end); throw error; }
        };
    }
    function inspect(node) {
        if (!(node instanceof Element) || node.closest('.ts-app-loading,.ts-feedback-region,[data-ts-inline-feedback]')) return;
        if (node.hasAttribute('aria-busy')) {
            if (node.getAttribute('aria-busy') === 'true' && visible(node)) regions.add(node); else regions.delete(node);
        }
        if (node.matches('button,input[type="submit"],a[role="button"]')) {
            const active = node.getAttribute('aria-busy') === 'true'
                || (node.disabled || node.getAttribute('aria-disabled') === 'true') && working.test((node.value || node.textContent || '').trim());
            if (active) node.setAttribute('data-ts-loading', 'true'); else node.removeAttribute('data-ts-loading');
        }
    }
    function inspectTree(root) {
        if (!(root instanceof Element) || root.closest('.ts-app-loading,.ts-feedback-region')) return;
        inspect(root); root.querySelectorAll(selector).forEach(inspect);
    }
    inspectTree(document.body);
    new MutationObserver(records => {
        const dirty = new Set();
        for (const record of records) {
            const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (!node || node.closest('.ts-app-loading,.ts-feedback-region')) continue;
            dirty.add(node); const parent = node.closest(selector); if (parent) dirty.add(parent);
            for (const child of record.addedNodes || []) if (child.nodeType === 1) dirty.add(child);
        }
        if (!dirty.size) return;
        dirty.forEach(inspectTree); render();
    }).observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-busy','aria-disabled','disabled','hidden','class','style']});
    function navigation() {
        navigating = true; clearTimeout(navigationTimer); render();
        // A cancelled browser navigation must not leave a permanent loading icon.
        navigationTimer = setTimeout(() => { navigating = false; render(); }, 15000);
    }
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
            || link.hasAttribute('download') || link.target && link.target !== '_self' || link.getAttribute('aria-disabled') === 'true') return;
        const url = new URL(link.href, window.location.href), here = new URL(window.location.href);
        if (url.origin !== here.origin || url.pathname === here.pathname && url.search === here.search
            || !/\.(?:php|html?)$|\/$/i.test(url.pathname) || /[?&](?:download|export)(?:=|&|$)/i.test(url.search)) return;
        queueMicrotask(() => { if (!event.defaultPrevented) navigation(); });
    });
    document.addEventListener('submit', event => {
        queueMicrotask(() => { if (!event.defaultPrevented && (!event.target.target || event.target.target === '_self')) navigation(); });
    });
    document.addEventListener('visibilitychange', render);
    window.addEventListener('pageshow', () => { navigating = false; clearTimeout(navigationTimer); inspectTree(document.body); render(); });
    window.addEventListener('pagehide', () => { navigating = false; tasks.clear(); regions.clear(); clearTimeout(navigationTimer); clearTimeout(timer); timer = null; panel.hidden = true; });
})();
