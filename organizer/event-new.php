<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Create Event', 'Build an event in clear steps, then preview and submit it for administrator approval.', '<button class="ts-btn ts-btn-secondary" id="save-event-draft">Save Draft</button>')?>
<div class="ts-steps">
    <div class="ts-step active" id="step-nav-1"><span class="ts-step-num">1</span>Basic Info</div><span class="ts-step-line"></span>
    <div class="ts-step" id="step-nav-2"><span class="ts-step-num">2</span>Venue</div><span class="ts-step-line"></span>
    <div class="ts-step" id="step-nav-3"><span class="ts-step-num">3</span>Media</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">4</span>Tickets</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">5</span>Rules</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">6</span>Review</div>
</div>
<div id="step-content-1">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Step 1 · Basic Information</div>
        <div class="ts-form-grid mt-20" id="event-form">
            <div class="ts-field span-2"><label class="ts-label">Event Name</label><input class="ts-input"
                    name="eventName" id="eventName" maxlength="120" required placeholder="e.g. Aurora After Dark"></div>
            <div class="ts-field span-2"><label class="ts-label">Event Description</label><textarea class="ts-textarea"
                    name="eventDescription" id="eventDescription" minlength="10" maxlength="5000" required placeholder="Describe the concert experience and key information buyers should know."></textarea></div>
            <div class="ts-field"><label class="ts-label">Event Category</label><select class="ts-select" name="eventCategory" id="eventCategory">
                    <option value="">Select category...</option>
                    <option value="Concert">Concert</option>
                    <option value="Festival">Festival</option>
                    <option value="Live Performance">Live Performance</option>
                </select></div>
            <div class="ts-field"><label class="ts-label">Event Date</label><input class="ts-input" type="date" name="eventDate" id="eventDate" required></div>
            <div class="ts-field"><label class="ts-label">Start Time</label><input class="ts-input" type="time" name="eventTime" id="eventTime" required></div>
            <div class="ts-field"><label class="ts-label">Organizer</label><input class="ts-input" id="organizerName"
                    value="Loading..." disabled></div>
        </div>
        <div class="flex justify-end mt-24">
            <button class="ts-btn ts-btn-primary" id="btn-next-1">Next: Venue</button>
        </div>
    </div>
</div>

<div id="step-content-2" style="display:none;">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Step 2 · Venue</div>
        <div class="ts-field mt-20">
            <label class="ts-label">Select Administrator-managed Venue</label>
            <select class="ts-select" id="venue-select" name="venueId" required>
                <option value="">Loading venues...</option>
            </select>
            <div class="ts-help">Only Administrator-approved venues with an active seating layout can be selected.</div>
        </div>

        <div class="ts-venue-preview-container" id="venue-preview-container">
            <div class="text-center p-20">Select a venue to preview layout</div>
        </div>

        <div class="flex justify-between mt-24">
            <button class="ts-btn ts-btn-secondary" id="btn-prev-2">Back</button>
            <button class="ts-btn ts-btn-primary" id="btn-next-2">Next: Media</button>
        </div>
    </div>
</div>

<div id="step-content-3" style="display:none;">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Step 3 · Promotional Media</div>
        <label class="ts-dropzone mt-20">
            <input type="file" id="poster-upload" accept="image/png,image/jpeg" style="display:none">
            <span class="ts-drop-icon">
                <?=ts_icon('upload')?>
            </span>
            <strong id="poster-name">Upload event poster</strong>
            <div class="small muted mt-8">PNG or JPG · recommended portrait artwork</div>
        </label>
        
        <div class="flex justify-between mt-24">
            <button class="ts-btn ts-btn-secondary" id="btn-prev-3">Back</button>
            <button class="ts-btn ts-btn-primary" id="create-event-btn">Submit & Continue to Ticket Configuration</button>
        </div>
    </div>
</div>

<script src="../assets/js/venue-renderer.js"></script>
<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const venueSelect = document.getElementById('venue-select');
    const submitBtn = document.getElementById('create-event-btn');
    const venuePreviewContainer = document.getElementById('venue-preview-container');
    const posterInput = document.getElementById('poster-upload');
    const posterName = document.getElementById('poster-name');
    const organizerNameInput = document.getElementById('organizerName');
    
    let venuesData = [];
    let currentEventId = new URLSearchParams(window.location.search).get('id');
    let originalVenueId = '';

    // Step Navigation
    const step1 = document.getElementById('step-content-1');
    const step2 = document.getElementById('step-content-2');
    const step3 = document.getElementById('step-content-3');
    const nav1 = document.getElementById('step-nav-1');
    const nav2 = document.getElementById('step-nav-2');
    const nav3 = document.getElementById('step-nav-3');
    
    function showStep(s) {
        step1.style.display = s === 1 ? 'block' : 'none';
        step2.style.display = s === 2 ? 'block' : 'none';
        step3.style.display = s === 3 ? 'block' : 'none';
        nav1.classList.toggle('active', s === 1);
        nav2.classList.toggle('active', s === 2);
        nav3.classList.toggle('active', s === 3);
        if (s > 1) nav1.classList.add('done'); else nav1.classList.remove('done');
        if (s > 2) nav2.classList.add('done'); else nav2.classList.remove('done');
    }

    const localToday = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const eventDateInput = document.getElementById('eventDate');
    if (eventDateInput) eventDateInput.min = localToday();

    const validateBasicInfo = () => {
        const V = window.tsValidation;
        const form = document.getElementById('event-form');
        V.clearFieldErrors(step1);
        const date = V.val(form, 'eventDate');
        const time = V.val(form, 'eventTime');
        const ok = V.runAll([
            {
                check: () => {
                    const v = V.val(form, 'eventName');
                    let r = V.validateRequired(v, 'Event Name');
                    if (!r.valid) return r;
                    r = V.validateMinLength(v, 3, 'Event Name');
                    if (!r.valid) return r;
                    return V.validateMaxLength(v, 120, 'Event Name');
                },
                el: V.el(form, 'eventName')
            },
            {
                check: () => {
                    const v = V.val(form, 'eventDescription');
                    let r = V.validateRequired(v, 'Description');
                    if (!r.valid) return r;
                    r = V.validateMinLength(v, 10, 'Description');
                    if (!r.valid) return r;
                    return V.validateMaxLength(v, 5000, 'Description');
                },
                el: V.el(form, 'eventDescription')
            },
            { check: () => V.validateSelect(V.val(form, 'eventCategory'), 'event category'), el: V.el(form, 'eventCategory') },
            {
                check: () => {
                    let r = V.validateRequired(date, 'Event Date');
                    if (!r.valid) return r;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { valid: false, error: 'Event Date is invalid.' };
                    if (time && new Date(`${date}T${time}`).getTime() <= Date.now()) {
                        return { valid: false, error: 'Event start must be in the future.' };
                    }
                    return { valid: true };
                },
                el: V.el(form, 'eventDate')
            },
            {
                check: () => {
                    const required = V.validateRequired(time, 'Start Time');
                    if (!required.valid) return required;
                    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { valid: false, error: 'Start Time is invalid.' };
                    return { valid: true };
                },
                el: V.el(form, 'eventTime')
            }
        ]);
        if (!ok) V.showGlobalError(step1, 'Check the event details', 'Correct the highlighted fields before continuing.');
        return ok;
    };

    const validateVenue = () => {
        const V = window.tsValidation;
        V.clearFieldErrors(step2);
        const selectedVenue = venuesData.find(venue => venue.id === venueSelect.value);
        const ok = V.runAll([
            {
                check: () => {
                    const selected = V.validateSelect(venueSelect.value, 'venue');
                    if (!selected.valid) return selected;
                    if (!selectedVenue) return { valid: false, error: 'Choose a currently active venue from the list.' };
                    const validSections = Array.isArray(selectedVenue.sections)
                        && selectedVenue.sections.some(section => Number(section.seatCount ?? section.seats) > 0);
                    return validSections
                        ? { valid: true }
                        : { valid: false, error: 'Choose a venue with an active seating layout.' };
                },
                el: venueSelect
            }
        ]);
        if (!ok) V.showGlobalError(step2, 'Choose a venue', 'Select an active venue with a usable seating layout.');
        return ok;
    };

    const validatePoster = () => {
        const V = window.tsValidation;
        V.clearFieldErrors(step3);
        const file = posterInput?.files?.[0];
        if (!file) return true;
        const ok = V.runAll([
            { check: () => V.validateFileType(file, ['image/jpeg', 'image/png']), el: posterInput },
            { check: () => V.validateFileSize(file, 5 * 1024 * 1024), el: posterInput }
        ]);
        if (!ok) V.showGlobalError(step3, 'Poster could not be used', 'Use a JPG or PNG image no larger than 5 MB.');
        return ok;
    };

    document.getElementById('btn-next-1').addEventListener('click', (e) => {
        e.preventDefault();
        if (validateBasicInfo()) showStep(2);
    });

    document.getElementById('btn-prev-2').addEventListener('click', (e) => { e.preventDefault(); showStep(1); });
    
    document.getElementById('btn-next-2').addEventListener('click', (e) => {
        e.preventDefault();
        if (validateVenue()) showStep(3);
    });

    document.getElementById('btn-prev-3').addEventListener('click', (e) => { e.preventDefault(); showStep(2); });
    
    // UI for poster upload
    if (posterInput && posterName) {
        posterInput.addEventListener('change', () => {
            if (posterInput.files && posterInput.files.length > 0) {
                posterName.textContent = posterInput.files[0].name;
                validatePoster();
            } else {
                posterName.textContent = 'Upload event poster';
            }
        });
    }

    // Handle venue selection for preview
    if (venueSelect && venuePreviewContainer) {
        venueSelect.addEventListener('change', () => {
            const vId = venueSelect.value;
            if (!vId) {
                venuePreviewContainer.innerHTML = '<div class="text-center p-20">Select a venue to preview layout</div>';
                return;
            }
            const selected = venuesData.find(v => v.id === vId);
            if (selected && window.tsVenueRenderer) {
                venuePreviewContainer.innerHTML = '<div id="venue-board-preview" class="ts-reusable-venue-plan" style="border-radius:12px; margin-top:20px;"></div>';
                window.tsVenueRenderer.renderBoard('venue-board-preview', selected.sections || []);
            }
        });
    }
    
    // Load venues & profile
    window.addEventListener('ts-auth-ready', async () => {
        try {
            const profile = await window.tsUsers.getCurrentProfile();
            if (profile && organizerNameInput) {
                organizerNameInput.value = profile.companyName || profile.fullName || profile.email || 'Organizer';
            }
        
            venuesData = await window.tsVenues.getActiveVenues();
            if(venuesData.length > 0 && venueSelect) {
                venueSelect.innerHTML = '<option value="">Select a venue...</option>' + venuesData.map(v => 
                    `<option value="${v.id}">${v.name} · ${v.address}</option>`
                ).join('');
            } else if (venueSelect) {
                venueSelect.innerHTML = '<option value="">No active venues available</option>';
            }
            if (currentEventId) {
                const existingEvent = await window.tsEvents.getEvent(currentEventId);
                if (!existingEvent || existingEvent.status !== 'DRAFT') {
                    throw new Error('Only your draft events can be edited.');
                }
                originalVenueId = existingEvent.venueId || '';
                document.querySelector('.ts-page-title').textContent = 'Edit Event';
                document.querySelector('.ts-page-subtitle').textContent = 'Update the draft before configuring tickets and rules.';
                document.getElementById('eventName').value = existingEvent.name || '';
                document.getElementById('eventDescription').value = existingEvent.description || '';
                document.getElementById('eventCategory').value = existingEvent.eventCategory || '';
                document.getElementById('eventDate').value = existingEvent.date || '';
                document.getElementById('eventTime').value = existingEvent.time || '';
                venueSelect.value = existingEvent.venueId || '';
                venueSelect.dispatchEvent(new Event('change'));
                if (existingEvent.posterUrl) posterName.textContent = 'Current poster saved';
            }
        } catch(e) {
            console.error('Failed to load initial data', e);
            window.tsValidation.showGlobalError(step1, 'Event could not be loaded', e.message);
            submitBtn.disabled = true;
            document.getElementById('save-event-draft').disabled = true;
        }
    });

    const persistDraft = async () => {
        const V = window.tsValidation;
        if (!validateBasicInfo()) {
            showStep(1);
            return null;
        }
        if (!validateVenue()) {
            showStep(2);
            return null;
        }
        if (!validatePoster()) {
            showStep(3);
            return null;
        }
        const selectedVenue = venuesData.find(v => v.id === venueSelect.value);
        const venueChanged = currentEventId && originalVenueId && originalVenueId !== venueSelect.value;
        if (venueChanged && !window.confirm('Changing the venue removes its existing ticket categories. Continue?')) {
            return null;
        }
        const eventData = {
            name: V.val(document.getElementById('event-form'), 'eventName'),
            description: V.val(document.getElementById('event-form'), 'eventDescription'),
            eventCategory: V.val(document.getElementById('event-form'), 'eventCategory'),
            date: V.val(document.getElementById('event-form'), 'eventDate'),
            time: V.val(document.getElementById('event-form'), 'eventTime'),
            venueId: venueSelect.value,
            venueName: selectedVenue?.name || '',
            venueLocation: selectedVenue?.address || ''
        };
        if (venueChanged) {
            eventData.categories = {};
            eventData.startingPrice = '';
        }
        if (currentEventId) {
            await window.tsEvents.updateEvent(currentEventId, eventData);
        } else {
            currentEventId = await window.tsEvents.createEvent(eventData);
            const url = new URL(window.location.href);
            url.searchParams.set('id', currentEventId);
            window.history.replaceState(null, '', url);
        }
        originalVenueId = venueSelect.value;
        if (posterInput?.files?.length) {
            await window.tsEvents.uploadPoster(currentEventId, posterInput.files[0]);
            posterName.textContent = posterInput.files[0].name;
            posterInput.value = '';
        }
        return currentEventId;
    };

    document.getElementById('save-event-draft').addEventListener('click', async (e) => {
        e.preventDefault();
        const saveButton = e.currentTarget;
        saveButton.disabled = true;
        try {
            const eventId = await persistDraft();
            if (eventId) window.tsShowToast('Event draft saved');
        } catch (err) {
            window.tsValidation.showGlobalError(step3, 'Draft could not be saved', err.message);
            showStep(3);
        } finally {
            saveButton.disabled = false;
        }
    });

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        try {
            const eventId = await persistDraft();
            if (eventId) window.location.href = `configuration.php?id=${encodeURIComponent(eventId)}`;
        } catch (err) {
            window.tsValidation.showGlobalError(step3, 'Event could not be saved', err.message);
            showStep(3);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit & Continue to Ticket Configuration';
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Create Event', 'create', $content, '..', '');
?>
