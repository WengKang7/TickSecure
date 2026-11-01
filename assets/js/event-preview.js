// Loaded only for the organizer's explicit public-page preview.
(() => {
    document.body.classList.add('ts-view-only-preview');
    function disableControls() {
        document.querySelectorAll('button,input,select,textarea').forEach(control => {
            if (!control.disabled) control.disabled = true;
        });
        document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"],[tabindex]').forEach(control => {
            if (control.getAttribute('aria-disabled') !== 'true') control.setAttribute('aria-disabled', 'true');
            if (control.getAttribute('tabindex') !== '-1') control.setAttribute('tabindex', '-1');
            if (control.hasAttribute('href')) control.removeAttribute('href');
        });
        // Policies remain readable without requiring an interactive disclosure.
        document.querySelectorAll('details').forEach(details => { if (!details.open) details.open = true; });
    }
    function blockAction(event) {
        if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
        if (!event.target.closest?.('a,button,input,select,textarea,summary,[role="button"],[tabindex]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }
    document.addEventListener('click', blockAction, true);
    document.addEventListener('keydown', blockAction, true);
    disableControls();
    new MutationObserver(disableControls).observe(document.body, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['disabled', 'href', 'tabindex', 'aria-disabled', 'open']
    });
})();
