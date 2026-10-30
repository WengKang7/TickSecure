(() => {
    const el = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ruleFields = {
        salesStartDate: 'salesStart', salesEndDate: 'salesEnd', maxTicketsPerBuyer: 'maxTickets',
        maxResaleMarkup: 'maxResaleMarkup', maxResalePrice: 'maxResalePrice',
        resaleStartDate: 'resaleStart', resaleDeadline: 'resaleEnd'
    };
    const categoryFields = { name: 'catName', sectionId: 'catSection', price: 'catPrice', quantity: 'catQuantity' };
    const eventId = new URLSearchParams(window.location.search).get('id');
    let seatEditor = null;
    let event, venue, categories = [], editing = -1, initialized = false, busy = false, dirty = false;
    const invalid = (fieldId, message) => ({ fieldId, message });
    function clearFieldError(id) {
        const field = el(id), message = el(`${id}-error`);
        if (!field || !message) return;
        message.hidden = true;
        message.textContent = '';
        field.removeAttribute('aria-invalid');
        const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value !== message.id);
        if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
        else field.removeAttribute('aria-describedby');
    }
    function clearErrors() {
        el('config-error').hidden = true;
        [...Object.values(ruleFields), ...Object.values(categoryFields)].forEach(clearFieldError);
    }
    function editCategory(index) {
        editing = index;
        Object.entries(categoryFields).forEach(([key, id]) => {
            clearFieldError(id);
            el(id).value = categories[editing][key];
        });
        el('add-cat-btn').textContent = 'Update Category';
        seatEditor?.edit(categories[editing]);
    }
    function error(problem) {
        const message = typeof problem === 'string' ? problem : problem.message;
        if (Number.isInteger(problem.categoryIndex)) editCategory(problem.categoryIndex);
        const field = el(problem.fieldId), inline = el(`${problem.fieldId}-error`);
        if (field && inline) {
            el('config-error').hidden = true;
            inline.textContent = message;
            inline.hidden = false;
            field.setAttribute('aria-invalid', 'true');
            const describedBy = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
            describedBy.add(inline.id);
            field.setAttribute('aria-describedby', [...describedBy].join(' '));
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field.focus({ preventScroll: true });
            return;
        }
        el('config-error').textContent = message;
        el('config-error').hidden = false;
        const target = field || el('config-error');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
    }
    const rules = () => ({ ...Object.fromEntries(Object.entries(ruleFields).map(([key, id]) => [key, el(id).value])),
        transferEnabled: el('transferEnabled').checked, resaleEnabled: el('resaleEnabled').checked });
    const category = () => ({ ...Object.fromEntries(Object.entries(categoryFields).map(([key, id]) => [key, el(id).value])),
        editingSectionId: editing >= 0 ? categories[editing]?.sectionId || '' : '', ...(seatEditor?.value() || {}) });
    const capacity = sectionId => Number((venue?.sections || []).find(section => String(section.sectionId) === sectionId)?.seatCount || 0);
    function changed(e) {
        if (e?.target?.id) clearFieldError(e.target.id);
        dirty = true;
        el('config-save-status').textContent = 'Unsaved changes. Save Draft keeps everything entered here, including unfinished fields.';
        el('configuration-review').hidden = true;
        window.tsEventPolicy.render(el('buyer-rules-preview'), { ...event, ...rules(), categories });
    }
    function lock(value) {
        busy = value;
        ['save-config-draft', 'review-config-btn', 'confirm-btn', 'submit-config-btn', 'add-cat-btn', 'clear-cat-btn',
            ...Object.values(ruleFields), ...Object.values(categoryFields), 'transferEnabled', 'resaleEnabled'].forEach(id => { el(id).disabled = value; });
        if (!value && !el('resaleEnabled').checked) ['maxResaleMarkup', 'maxResalePrice', 'resaleStart', 'resaleEnd'].forEach(id => { el(id).disabled = true; });
        el('categories-tbody').querySelectorAll('button').forEach(button => { button.disabled = value; });
    }
    function clearCategory() {
        Object.values(categoryFields).forEach(id => { el(id).value = ''; clearFieldError(id); });
        editing = -1;
        seatEditor?.clear();
        el('add-cat-btn').textContent = 'Add Category';
    }
    function renderCategories() {
        el('categories-tbody').innerHTML = categories.map((item, index) => `<tr>
            <td class="cell-title">${esc(item.name)}</td><td>${Array.isArray(item.seatLabels) ? esc(item.seatLabels.length + ' selected seats') : esc((venue?.sections || []).find(section => section.sectionId === item.sectionId)?.name || item.sectionId)}</td>
            <td>RM${Number(item.price).toFixed(2)}</td><td>${Number(item.quantity)} tickets</td>
            <td>${Array.isArray(item.seatLabels) ? `${item.seatLabels.length} assigned` : Number(item.quantity) <= capacity(item.sectionId) ? `Up to ${capacity(item.sectionId)} tickets` : `Exceeds the ${capacity(item.sectionId)}-ticket limit`}</td>
            <td><button class="ts-btn ts-btn-secondary ts-btn-sm" data-edit-category="${index}" type="button">Edit</button> <button class="ts-btn ts-btn-secondary ts-btn-sm" data-remove-category="${index}" type="button">Remove</button></td></tr>`).join('')
            || '<tr><td colspan="6" class="text-center">No categories configured. You can save a draft before adding categories.</td></tr>';
        seatEditor?.render();
        el('categories-tbody').querySelectorAll('[data-edit-category]').forEach(button => button.addEventListener('click', () => {
            editCategory(Number(button.dataset.editCategory));
            changed();
            el('catName').focus();
        }));
        el('categories-tbody').querySelectorAll('[data-remove-category]').forEach(button => button.addEventListener('click', () => {
            const index = Number(button.dataset.removeCategory);
            categories.splice(index, 1);
            if (editing === index) clearCategory();
            else if (editing > index) editing--;
            renderCategories();
            changed();
        }));
    }
    function validateCategory(value, index = -1) {
        const name = String(value.name).trim(), sectionId = String(value.sectionId);
        if (name.length < 2 || name.length > 80) return invalid('catName', 'Category name must contain 2 to 80 characters.');
        const exact = Array.isArray(value.seatLabels);
        if (exact) { const problem = window.tsSeatCategories.validate(value, categories, venue?.sections || [], index >= 0 ? categories[index].sectionId : null); if (problem) return invalid('catQuantity', problem); }
        if (!exact && !capacity(sectionId)) return invalid('catSection', 'Choose a physical section from the selected venue.');
        if (!/^\d+(?:\.\d{1,2})?$/.test(String(value.price)) || Number(value.price) < 1 || Number(value.price) > 99999) return invalid('catPrice', 'Enter a ticket price from RM1.00 to RM99,999.00 with at most two decimal places.');
        if (!exact && (!/^\d+$/.test(String(value.quantity)) || Number(value.quantity) < 1 || Number(value.quantity) > capacity(sectionId))) return invalid('catQuantity', `Enter a whole ticket quantity between 1 and ${capacity(sectionId)} for this section.`);
        if (!exact && categories.some((item, i) => i !== index && item.sectionId === sectionId)) return invalid('catSection', 'This section already has a category. Edit its existing category instead.');
        if (categories.some((item, i) => i !== index && item.name.toLowerCase() === name.toLowerCase())) return invalid('catName', 'Each category needs a different name.');
        return '';
    }
    function applyCategoryForReview() {
        const value = category();
        // Choosing a section alone is not an unfinished ticket category.
        if (![value.name, value.price, value.quantity].some(item => String(item).trim() !== '')) {
            clearCategory();
            return '';
        }
        // Old drafts or an unchanged Edit selection can leave a copy of an
        // already configured row in the editor. It must not block review.
        const unchanged = categories.some((item, index) => (editing < 0 || index === editing) && item.sectionId === value.sectionId
            && String(item.name).trim() === value.name.trim()
            && Number(item.price) === Number(value.price)
            && Number(item.quantity) === Number(value.quantity)
            && JSON.stringify(item.seatLabels || null) === JSON.stringify(value.seatLabels || null)
            && (item.color || '') === (value.color || ''));
        if (unchanged) {
            clearCategory();
            changed();
            return '';
        }
        const problem = validateCategory(value, editing);
        if (problem) return problem;
        const item = { name: value.name.trim(), sectionId: value.sectionId, price: Number(value.price), quantity: Number(value.quantity), ...(Array.isArray(value.seatLabels) ? { seatLabels: value.seatLabels, color: value.color } : {}) };
        if (editing >= 0) categories[editing] = item;
        else categories.push(item);
        clearCategory();
        renderCategories();
        changed();
        return '';
    }
    async function saveDraft() {
        if (busy || !initialized) return false;
        lock(true);
        clearErrors();
        try {
            await window.tsEvents.saveConfigurationDraft(eventId, { categories, rules: rules(), category: category() });
            dirty = false;
            el('config-save-status').textContent = 'Draft saved. Your event is still private and has not been submitted.';
            window.tsShowToast('Draft saved. You can finish it later.');
            return true;
        } catch (reason) { error(reason.message || 'Your draft could not be saved.'); return false; }
        finally { lock(false); }
    }
    function validateForSubmission() {
        const startsAt = window.tsEventPolicy.timestamp(`${event.date}T${event.time}`);
        if (!event.name || event.name.trim().length < 3 || !event.description || event.description.trim().length < 10
            || !event.eventCategory || !Number.isFinite(startsAt) || startsAt <= Date.now()
            || !venue || venue.layoutStatus !== 'ACTIVE') {
            return invalid('edit-event-details', 'Complete the event name, description, category, future date/time, and active venue in Edit Event Details before submitting.');
        }
        if (!categories.length) return invalid('catName', 'Add at least one ticket category before submitting.');
        for (let index = 0; index < categories.length; index++) {
            const problem = validateCategory(categories[index], index);
            if (problem) return { ...problem, categoryIndex: index };
        }
        const data = rules();
        const start = window.tsEventPolicy.timestamp(data.salesStartDate), end = window.tsEventPolicy.timestamp(data.salesEndDate, true);
        if (!Number.isFinite(start) || start <= Date.now() || start >= startsAt) return invalid('salesStart', 'Sales must open in the future and before the event starts.');
        if (!Number.isFinite(end) || end <= start || end > startsAt) return invalid('salesEnd', 'Sales must close after they open and no later than the event starts.');
        const total = categories.reduce((sum, item) => sum + Number(item.quantity), 0);
        if (!/^\d+$/.test(data.maxTicketsPerBuyer) || Number(data.maxTicketsPerBuyer) < 1 || Number(data.maxTicketsPerBuyer) > Math.min(20, total)) return invalid('maxTickets', `Set the buyer ticket limit between 1 and ${Math.min(20, total)}.`);
        if (data.resaleEnabled) {
            const resaleStart = window.tsEventPolicy.timestamp(data.resaleStartDate), resaleEnd = window.tsEventPolicy.timestamp(data.resaleDeadline, true);
            if (!Number.isFinite(resaleStart) || resaleStart < start || resaleStart >= startsAt) return invalid('resaleStart', 'Resale must open on or after sales open, and before the event starts.');
            if (!Number.isFinite(resaleEnd) || resaleEnd <= resaleStart || resaleEnd > startsAt) return invalid('resaleEnd', 'Resale must close after it opens and no later than the event starts.');
            if (data.maxResalePrice === '' && (!/^\d+(?:\.\d{1,2})?$/.test(data.maxResaleMarkup) || Number(data.maxResaleMarkup) > 100)) return invalid('maxResaleMarkup', 'Set a resale markup from 0% to 100%, using at most two decimal places.');
            if (data.maxResalePrice !== '' && (!/^\d+(?:\.\d{1,2})?$/.test(data.maxResalePrice) || Number(data.maxResalePrice) < 1 || Number(data.maxResalePrice) > 99999)) return invalid('maxResalePrice', 'Leave the fixed resale cap blank, or enter an amount from RM1.00 to RM99,999.00.');
        }
        return '';
    }
    function review() {
        if (busy || !initialized) return;
        clearErrors();
        const categoryProblem = applyCategoryForReview();
        if (categoryProblem) { error(categoryProblem); return; }
        const problem = validateForSubmission();
        if (problem) { error(problem); return; }
        el('review-event-summary').textContent = `${event.name} · ${venue.name} · ${window.tsEventPolicy.date(`${event.date}T${event.time}`)} (Malaysia time)`;
        el('review-category-summary').textContent = categories.map(item => `${item.name}: RM${Number(item.price).toFixed(2)}, ${item.quantity} tickets`).join(' | ');
        el('configuration-review').hidden = false;
        el('configuration-review').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('ts-auth-ready', async () => {
        if (initialized) return;
        if (!eventId) { error('Choose a draft from My Events, or create an event first.'); return; }
        try {
            event = await window.tsEvents.getEvent(eventId);
            if (!event || event.status !== 'DRAFT' || event.organizerUid !== window.tsCurrentUser?.uid) throw new Error('Only your own draft events can be edited.');
            venue = event.venueId ? await window.tsVenues.getVenue(event.venueId) : null;
            el('edit-event-details').href = `event-new.php?id=${encodeURIComponent(eventId)}`;
            const subtitle = document.querySelector('.ts-page-subtitle');
            if (subtitle) subtitle.textContent = `Tickets and rules for ${event.name || 'Untitled event'}. You can return to edit the name, venue, date, and other details.`;
            const venueSubtitle = document.querySelector('.ts-card-sub');
            if (venueSubtitle) venueSubtitle.textContent = venue ? `${venue.name} · Administrator-managed physical layout` : 'No venue selected. Use Edit Event Details to choose one.';
            el('venue-sections-title').textContent = venue ? `Venue Sections · ${venue.name}` : 'Venue not selected';
            window.tsVenueRenderer?.renderBoard('mini-venue-board', venue?.sections || [], { cleanLayout: true, fitContainer: true });
            el('venue-sections-list').innerHTML = (venue?.sections || []).map(section => `<div class="ts-list-item"><div><div class="ts-list-title">${esc(section.name)}</div><div class="ts-list-sub">${Number(section.seatCount)} physical seats</div></div></div>`).join('') || 'Choose a venue in Event Details before mapping ticket categories.';
            el('catSection').innerHTML = '<option value="">Select section...</option>' + (venue?.sections || []).map(section => `<option value="${esc(section.sectionId)}">${esc(section.name)} · ${Number(section.seatCount)} seats</option>`).join('');
            categories = Array.isArray(event.categories) ? event.categories.map(item => ({ ...item, sectionId: item.sectionId || item.section || item.id || '' }))
                : Object.entries(event.categories || {}).map(([sectionId, item]) => ({ ...item, sectionId }));
            const savedRules = event.configurationDraft?.rules || event;
            Object.entries(ruleFields).forEach(([key, id]) => {
                let value = savedRules[key] ?? (key === 'maxTicketsPerBuyer' ? 4 : key === 'maxResaleMarkup' ? 0 : '');
                if (id.startsWith('sales') || id.startsWith('resale')) {
                    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(value))) {
                        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
                        const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
                        value = `${date.year}-${date.month}-${date.day}T${date.hour}:${date.minute}`;
                    } else if (String(value).includes('T')) value = String(value).slice(0, 16);
                }
                el(id).value = value;
            });
            // Older date-only policies retain their full inclusive end day.
            ['salesEnd', 'resaleEnd'].forEach(id => { if (/^\d{4}-\d{2}-\d{2}$/.test(String(el(id).value))) el(id).value += 'T23:59'; });
            ['salesStart', 'resaleStart'].forEach(id => { if (/^\d{4}-\d{2}-\d{2}$/.test(String(el(id).value))) el(id).value += 'T00:00'; });
            if (Number(el('maxResalePrice').value) === 0) el('maxResalePrice').value = '';
            ['transferEnabled', 'resaleEnabled'].forEach(id => { el(id).checked = savedRules[id] !== false; });
            const pending = event.configurationDraft?.category;
            if (pending) {
                Object.entries(categoryFields).forEach(([key, id]) => { el(id).value = pending[key] ?? ''; });
                editing = pending.editingSectionId ? categories.findIndex(item => item.sectionId === pending.editingSectionId) : -1;
                if (editing >= 0) el('add-cat-btn').textContent = 'Update Category';
            }
            seatEditor = window.tsOrganizerSeatCategories?.({ venue: venue || { sections: [] }, categories: () => categories, editing: () => editing, changed, isBusy: () => busy }) || null;
            if (seatEditor && pending) seatEditor.edit(pending);
            renderCategories();
            window.tsEventPolicy.render(el('buyer-rules-preview'), { ...event, ...rules(), categories });
            initialized = true;
            lock(false);
        } catch (reason) { error(reason.message || 'The event could not be loaded.'); return; }

        [...Object.values(ruleFields), ...Object.values(categoryFields), 'transferEnabled', 'resaleEnabled'].forEach(id => {
            el(id).addEventListener('input', changed);
            el(id).addEventListener('change', changed);
        });
        el('resaleEnabled').addEventListener('change', () => {
            ['maxResaleMarkup', 'maxResalePrice', 'resaleStart', 'resaleEnd'].forEach(id => {
                el(id).disabled = !el('resaleEnabled').checked;
                if (!el('resaleEnabled').checked) clearFieldError(id);
            });
        });
        el('resaleEnabled').dispatchEvent(new Event('change'));
        dirty = false;
        el('config-save-status').textContent = 'Save Draft keeps your current work, including unfinished fields. Submit only when everything is ready.';
        el('add-cat-btn').addEventListener('click', () => {
            if (busy) return;
            clearErrors();
            const value = category(), problem = validateCategory(value, editing);
            if (problem) { error(problem); return; }
            const item = { name: value.name.trim(), sectionId: value.sectionId, price: Number(value.price), quantity: Number(value.quantity), ...(Array.isArray(value.seatLabels) ? { seatLabels: value.seatLabels, color: value.color } : {}) };
            if (editing >= 0) categories[editing] = item;
            else categories.push(item);
            clearCategory();
            renderCategories();
            changed();
        });
        el('save-config-draft').addEventListener('click', saveDraft);
        el('clear-cat-btn').addEventListener('click', () => { clearCategory(); changed(); });
        el('edit-event-details').addEventListener('click', async e => {
            if (busy) { e.preventDefault(); return; }
            if (!dirty) return;
            e.preventDefault();
            if (await saveDraft()) window.location.href = el('edit-event-details').href;
        });
        el('review-config-btn').addEventListener('click', review);
        el('confirm-btn').addEventListener('click', review);
        el('submit-config-btn').addEventListener('click', async () => {
            if (busy || el('configuration-review').hidden) return;
            clearErrors();
            const problem = validateForSubmission();
            if (problem) { error(problem); return; }
            lock(true);
            try {
                if (!await window.tsDecision('submitEvent', event.name || 'Event draft', [['Venue', venue.name || event.venueName || 'Selected venue'], ['Categories', categories.length]])) { lock(false); return; }
                const data = rules();
                ['maxTicketsPerBuyer', 'maxResaleMarkup', 'maxResalePrice'].forEach(key => { data[key] = Number(data[key]) || 0; });
                await window.tsEvents.saveCompletedConfiguration(eventId, categories, data);
                await window.tsEvents.submitForApproval(eventId);
                dirty = false;
                window.location.href = 'events.php';
            } catch (reason) { error(reason.message || 'The event could not be submitted.'); lock(false); }
        });
    });
})();
