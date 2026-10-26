(() => {
    const el = id => document.getElementById('admin-confirm-' + id);
    const dialog = el('dialog');
    if (!dialog) return;
    const reason = [{ name: 'reason', label: 'Reason', maxLength: 1000 }];
    const actions = {
        approveEvent: { title: 'Approve and publish event?', message: 'This event will become visible to buyers. Ticket purchases will be available during its sales window.', label: 'Approve & Publish', tone: 'success' },
        rejectEvent: { title: 'Reject this event?', message: 'This submission will be rejected and will not be published. The organizer will receive the reason below.', label: 'Reject Event', tone: 'danger', fields: reason },
        suspendEvent: { title: 'Suspend this event?', message: 'Ticket purchases, transfers and resale will be unavailable while the event is suspended. Existing ticket records will be kept.', label: 'Suspend Event', tone: 'danger', fields: reason },
        approveOrganizer: { title: 'Approve this organizer?', message: 'This account will become active and can access organizer features, including creating and submitting events.', label: 'Approve Organizer', tone: 'success' },
        rejectOrganizer: { title: 'Reject this organizer?', message: 'This organizer application will be rejected. The applicant will receive the reason below.', label: 'Reject Organizer', tone: 'danger', fields: reason },
        suspendUser: { title: 'Suspend this account?', message: 'This user will lose access to their TickSecure account while suspended. Their existing records will be kept.', label: 'Suspend Account', tone: 'danger', fields: reason },
        reactivateUser: { title: 'Reactivate this account?', message: 'This user will regain account access, subject to their role and email verification requirements.', label: 'Reactivate Account', tone: 'success' },
        deleteVenue: { title: 'Delete this draft venue?', message: 'The venue record will be permanently deleted. This action cannot be undone.', label: 'Delete Venue', tone: 'danger' },
        updateVenue: { title: 'Save these venue changes?', message: 'The venue name, address and capacity will be updated. Review the new details below before saving.', label: 'Save Venue Changes' },
        confirmSections: { title: 'Confirm these venue sections?', message: 'These physical sections and seat counts will be saved as the layout used to generate seats. Review the totals before continuing.', label: 'Confirm Sections' },
        activateLayout: { title: 'Activate this venue layout?', message: 'Physical seat records will be generated and the venue will become available for organizers. Its sections will be locked after activation.', label: 'Activate Layout', tone: 'success' },
        replaceBlueprint: { title: 'Replace the venue blueprint?', message: 'The selected PDF will replace the current blueprint reference. Its seating sections will need to be reviewed before activation.', label: 'Replace Blueprint', tone: 'danger' },
        suspendListing: { title: 'Suspend this resale listing?', message: 'Buyers will no longer be able to purchase this listing while it is suspended. The seller will be notified of the reason.', label: 'Suspend Listing', tone: 'danger', fields: reason },
        investigateComplaint: { title: 'Start investigating this complaint?', message: 'The complaint status will change to Under investigation and the action will be recorded in its timeline.', label: 'Start Investigation' },
        rejectComplaint: { title: 'Reject this complaint?', message: 'The complaint will be closed as rejected and the reason will be recorded in its timeline.', label: 'Reject Complaint', tone: 'danger', fields: reason },
        resolveComplaint: { title: 'Resolve this complaint?', message: 'The complaint will be marked as resolved and the resolution below will be recorded in its timeline. Any refund or other follow-up must be carried out separately.', label: 'Resolve Complaint', tone: 'success', fields: [
            { name: 'action', label: 'Resolution action', maxLength: 200 },
            { name: 'explanation', label: 'Resolution explanation', maxLength: 2000 }
        ] }
    };
    let pending = null;
    function finish(result) {
        if (!pending) return;
        const { resolve, trigger } = pending;
        pending = null;
        dialog.close();
        el('fields').replaceChildren();
        el('details').replaceChildren();
        el('subject').textContent = '';
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
        resolve(result);
    }
    // A single modal is shared by admin pages. No write is performed here.
    window.tsAdminConfirm = (action, subject, details = []) => {
        const config = actions[action];
        if (!config || pending || window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return Promise.resolve(null);
        el('title').textContent = config.title;
        el('message').textContent = config.message;
        el('subject').textContent = String(subject || 'Selected record');
        el('submit').textContent = config.label;
        el('submit').className = 'ts-btn ts-btn-' + (config.tone || 'primary');
        el('details').replaceChildren();
        el('details').hidden = !details.length;
        details.forEach(([label, value]) => {
            const term = document.createElement('dt'), description = document.createElement('dd');
            term.textContent = label;
            description.textContent = String(value ?? 'Not provided');
            el('details').append(term, description);
        });
        const fields = (config.fields || []).map(field => {
            const wrapper = document.createElement('div');
            wrapper.className = 'ts-field mt-16';
            const label = document.createElement('label'), input = document.createElement('textarea');
            label.className = 'ts-label';
            label.textContent = field.label + ' (required)';
            label.htmlFor = input.id = 'admin-confirm-' + field.name;
            input.className = 'ts-input';
            input.name = field.name;
            input.required = true;
            input.maxLength = field.maxLength;
            input.rows = field.name === 'action' ? 2 : 3;
            input.addEventListener('input', () => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); });
            wrapper.append(label, input);
            el('fields').appendChild(wrapper);
            return input;
        });
        return new Promise(resolve => {
            pending = { resolve, fields, trigger: document.activeElement, uid: window.tsCurrentUser.uid };
            try {
                dialog.showModal();
                // Cancel is the initial choice; keyboard users can tab to the fields.
                el('cancel').focus();
            } catch { finish(null); }
        });
    };
    el('form').addEventListener('submit', event => {
        event.preventDefault();
        if (!pending) return;
        if (window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active' || window.tsCurrentUser.uid !== pending.uid) {
            finish(null);
            return;
        }
        const result = {};
        for (const input of pending.fields) {
            const value = input.value.trim();
            input.setCustomValidity(value ? '' : 'Enter a reason or explanation before confirming.');
            if (!input.reportValidity()) {
                input.setAttribute('aria-invalid', 'true');
                input.focus();
                return;
            }
            result[input.name] = value;
        }
        finish(result);
    });
    el('cancel').addEventListener('click', () => finish(null));
    el('close').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => { if (!dialog.open) finish(null); });
    dialog.addEventListener('click', event => { if (event.target === dialog) finish(null); });
    window.addEventListener('pagehide', () => finish(null));
    window.addEventListener('ts-auth-ready', event => {
        if (event.detail?.role !== 'admin' || event.detail.status !== 'active' || (pending && event.detail.uid !== pending.uid)) finish(null);
    });
})();
