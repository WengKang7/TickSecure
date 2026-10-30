(() => {
    const el = id => document.getElementById('ts-decision-' + id);
    const dialog = el('dialog');
    if (!dialog) return;
    const actions = {
        logout: { title: 'Ready to sign out?', message: 'You will be signed out of TickSecure on this browser. Save any unfinished changes before leaving.', label: 'Sign out', cancelLabel: 'Stay signed in' },
        archiveAccount: { title: 'Archive this account?', message: 'This account will lose access. Linked bookings, tickets and support history will be retained.', label: 'Archive account', tone: 'danger' },
        createAccount: { title: 'Create this account?', message: 'A new account will be created and a verification email will be requested. Organizer accounts still need approval.', label: 'Create account' },
        updateAccount: { title: 'Save account changes?', message: 'The account name and organization details shown in your form will be updated.', label: 'Save changes' },
        deleteDraft: { title: 'Delete this event draft?', message: 'The draft event will be permanently deleted. This action cannot be undone.', label: 'Delete draft', tone: 'danger' },
        reviseEvent: { title: 'Return this event to draft?', message: 'You can edit the rejected event and submit it for another review. Its current details will be kept.', label: 'Revise event' },
        changeVenue: { title: 'Change the event venue?', message: 'Ticket categories from the previous venue will be reset. Your other event details and sales rules will be kept.', label: 'Change venue', tone: 'danger' },
        submitEvent: { title: 'Submit this event for review?', message: 'The administrator will review your event. Editing is locked while it awaits a decision.', label: 'Submit event', tone: 'success' },
        deleteComplaint: { title: 'Delete this open complaint?', message: 'The complaint will be permanently removed. You cannot undo this decision.', label: 'Delete complaint', tone: 'danger' },
        submitComplaint: { title: 'Submit this complaint?', message: 'Your description and any attached evidence will be sent for administrator review.', label: 'Submit complaint' },
        deleteNotification: { title: 'Delete this notification?', message: 'This notification will be removed from your inbox. The related booking, ticket or support case will be kept.', label: 'Delete notification', tone: 'danger' },
        createListing: { title: 'List this ticket for resale?', message: 'Your ticket will be offered to other buyers at the price below. Cancel the listing before using or transferring the ticket.', label: 'Create listing', tone: 'success' },
        cancelListing: { title: 'Cancel this resale listing?', message: 'Buyers will no longer be able to purchase this listing. Your eligible ticket will return to your tickets.', label: 'Cancel listing', tone: 'danger' },
        repriceListing: { title: 'Change the resale price?', message: 'Enter the new ticket price. The organizer’s current price limit will be checked before saving.', label: 'Save price' },
        purchaseResale: { title: 'Purchase this resale ticket?', message: 'This records a simulated payment and transfers ticket ownership to your account. Review the total, including the service charge.', label: 'Purchase ticket', tone: 'success' },
        transferTicket: { title: 'Transfer ticket ownership?', message: 'This ticket will move to the recipient’s account. You will lose access to it. Check the full wallet address carefully.', label: 'Transfer ticket', tone: 'danger' },
        checkout: { title: 'Confirm your ticket purchase?', message: 'This records a simulated payment and issues your reserved tickets. Review your order before continuing.', label: 'Confirm purchase', tone: 'success' },
        releaseReservation: { title: 'Release your reserved seats?', message: 'These seats will become available to other buyers. You will need to reserve seats again to continue checkout.', label: 'Release seats', tone: 'danger' },
        confirmEntry: { title: 'Admit this ticket holder?', message: 'The ticket will be validated and marked as used if eligible. A used ticket cannot be admitted again.', label: 'Verify and admit', tone: 'success' },
        rescanBlueprint: { title: 'Detect seats again?', message: 'A new scan will replace the draft’s current detected seats and sections. Review the new result before activating the venue.', label: 'Scan again', tone: 'danger' }
    };
    let pending = null, lastTrigger = null;
    document.addEventListener?.('click', event => {
        if (!pending) lastTrigger = event.target?.closest?.('button, a, input, [tabindex]') || null;
    }, true);
    const identity = () => window.tsCurrentUser?.uid ?? window.tsFirebase?.auth?.currentUser?.uid ?? null;
    const allowed = config => !config.requireAdmin || (window.tsCurrentUser?.role === 'admin' && window.tsCurrentUser.status === 'active');
    const sameSession = decision => identity() === decision.uid && (window.tsCurrentUser?.role ?? null) === decision.role && (window.tsCurrentUser?.status ?? null) === decision.status;
    function finish(result) {
        if (!pending) return;
        const decision = pending;
        pending = null;
        dialog.close();
        el('fields').replaceChildren();
        el('details').replaceChildren();
        el('subject').textContent = '';
        decision.resolve(result);
        // Let the caller unlock its controls before restoring keyboard focus.
        Promise.resolve().then(() => {
            if (!pending && decision.trigger?.isConnected && !decision.trigger.disabled) decision.trigger.focus({ preventScroll: true });
        });
    }
    window.tsConfirmDecision = config => {
        if (!config?.title || pending || !allowed(config)) return Promise.resolve(null);
        dialog.setAttribute('data-tone', ['danger', 'success'].includes(config.tone) ? config.tone : 'primary');
        el('title').textContent = config.title;
        el('message').textContent = config.message || '';
        el('subject').textContent = String(config.subject || 'Selected action');
        el('submit').textContent = config.label || 'Confirm';
        el('cancel').textContent = config.cancelLabel || 'Cancel';
        el('details').replaceChildren();
        const details = config.details || [];
        el('details').hidden = !details.length;
        details.forEach(([label, value]) => {
            const term = document.createElement('dt'), description = document.createElement('dd');
            term.textContent = String(label); description.textContent = String(value ?? 'Not provided');
            el('details').append(term, description);
        });
        el('fields').replaceChildren();
        const fields = (config.fields || []).map(field => {
            const wrapper = document.createElement('div'), label = document.createElement('label');
            const input = document.createElement(field.type === 'price' ? 'input' : 'textarea');
            const error = document.createElement('p');
            wrapper.className = 'ts-decision-field';
            label.textContent = field.label + ' (required)';
            label.htmlFor = input.id = 'ts-decision-field-' + field.name;
            input.name = field.name; input.className = 'ts-decision-input'; input.required = true;
            input.maxLength = field.maxLength || 2000; input.value = String(field.value ?? '');
            input.setAttribute('aria-describedby', error.id = input.id + '-error');
            if (field.type === 'price') {
                input.type = 'text'; input.inputMode = 'decimal'; input.autocomplete = 'off';
            } else input.rows = field.name === 'action' ? 2 : 3;
            error.className = 'ts-decision-error'; error.setAttribute('role', 'alert'); error.hidden = true;
            input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); error.hidden = true; });
            wrapper.append(label, input, error); el('fields').appendChild(wrapper);
            return { input, error, field: { ...field } };
        });
        return new Promise(resolve => {
            pending = { resolve, fields, trigger: document.activeElement === document.body ? lastTrigger : document.activeElement, uid: identity(), role: window.tsCurrentUser?.role ?? null, status: window.tsCurrentUser?.status ?? null, config: { requireAdmin: config.requireAdmin } };
            try { dialog.showModal(); el('cancel').focus(); }
            catch (_) { finish(null); }
        });
    };
    window.tsDecision = (action, subject, details = [], options = {}) => {
        const config = actions[action];
        if (!config) return Promise.resolve(null);
        const maximum = Math.min(Number(options.maximum) > 0 ? Number(options.maximum) : 1000000, 1000000);
        const fields = action === 'repriceListing' ? [{ name: 'price', label: 'New resale price (RM)', type: 'price', value: options.price, maximum }] : [];
        return window.tsConfirmDecision({ ...config, subject, details, fields });
    };
    el('form').addEventListener('submit', event => {
        event.preventDefault();
        if (!pending) return;
        if (!sameSession(pending) || !allowed(pending.config)) { finish(null); return; }
        const result = {};
        for (const { input, error, field } of pending.fields) {
            const value = input.value.trim();
            let problem = !value ? 'Enter ' + field.label.toLowerCase() + ' before confirming.'
                : value.length > (field.maxLength || 2000) ? 'This entry is too long.' : '';
            if (!problem && field.type === 'price' && (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > field.maximum)) {
                problem = `Enter a price above RM0.00 and up to RM${field.maximum.toFixed(2)}, with at most two decimal places.`;
            }
            if (problem) {
                error.textContent = problem; error.hidden = false;
                input.setAttribute('aria-invalid', 'true'); input.focus(); return;
            }
            result[input.name] = value;
        }
        finish(result);
    });
    el('cancel').addEventListener('click', () => finish(null));
    el('close').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => { if (!dialog.open) finish(null); });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) finish(null);
    });
    window.addEventListener('pagehide', () => finish(null));
    window.addEventListener('ts-auth-ready', event => {
        if (pending && ((event.detail?.uid ?? null) !== pending.uid || !sameSession(pending) || !allowed(pending.config))) finish(null);
    });
    window.addEventListener('ts-profile-updated', () => {
        if (pending && (!sameSession(pending) || !allowed(pending.config))) finish(null);
    });
})();
