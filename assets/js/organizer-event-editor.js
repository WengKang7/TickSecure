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
    let originalEvent = null;
    let currentStep = 1;
    let ready = false;
    let saving = false;

    // Step Navigation
    const step1 = document.getElementById('step-content-1');
    const step2 = document.getElementById('step-content-2');
    const step3 = document.getElementById('step-content-3');
    const nav1 = document.getElementById('step-nav-1');
    const nav2 = document.getElementById('step-nav-2');
    const nav3 = document.getElementById('step-nav-3');
    
    function showStep(s) {
        currentStep = s;
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
                venuePreviewContainer.innerHTML = '<div id="venue-board-preview" class="ts-reusable-venue-plan" style="border-radius:12px;"></div>';
                window.tsVenueRenderer.renderBoard('venue-board-preview', selected.sections || [], { cleanLayout: true, fitContainer: true });
            }
        });
    }
    
    // Load venues & profile
    window.addEventListener('ts-auth-ready', async () => {
        if (ready) return;
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
                if (!existingEvent || existingEvent.status !== 'DRAFT' || existingEvent.organizerUid !== profile?.id) {
                    throw new Error('Only your draft events can be edited.');
                }
                originalVenueId = existingEvent.venueId || '';
                originalEvent = existingEvent;
                if (existingEvent.venueId && !venuesData.some(venue => venue.id === existingEvent.venueId)) {
                    const option = document.createElement('option');
                    option.value = existingEvent.venueId;
                    option.textContent = `${existingEvent.venueName || 'Previously selected venue'} (currently unavailable)`;
                    venueSelect.appendChild(option);
                }
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
            ready = true;
        } catch(e) {
            console.error('Failed to load initial data', e);
            window.tsValidation.showGlobalError(step1, 'Event could not be loaded', e.message);
            submitBtn.disabled = true;
            document.getElementById('save-event-draft').disabled = true;
        }
    });

    const persistDraft = async (requireComplete = false) => {
        const V = window.tsValidation;
        if (!ready) throw new Error('Wait for your event details to finish loading.');
        if (requireComplete && !validateBasicInfo()) {
            showStep(1);
            return null;
        }
        if (requireComplete && !validateVenue()) {
            showStep(2);
            return null;
        }
        if (!validatePoster()) {
            showStep(3);
            return null;
        }
        const selectedVenue = venuesData.find(v => v.id === venueSelect.value);
        const venueChanged = currentEventId && originalVenueId !== venueSelect.value;
        const hasCategories = Object.keys(originalEvent?.categories || {}).length > 0;
        if (venueChanged && hasCategories && !await window.tsDecision('changeVenue', V.val(document.getElementById('event-form'), 'eventName') || 'Event draft', [['New venue', selectedVenue?.name || 'No venue selected']])) {
            return null;
        }
        const eventData = {
            name: V.val(document.getElementById('event-form'), 'eventName'),
            description: V.val(document.getElementById('event-form'), 'eventDescription'),
            eventCategory: V.val(document.getElementById('event-form'), 'eventCategory'),
            date: V.val(document.getElementById('event-form'), 'eventDate'),
            time: V.val(document.getElementById('event-form'), 'eventTime'),
            venueId: venueSelect.value,
            venueName: selectedVenue?.name || (!venueChanged ? originalEvent?.venueName : '') || '',
            venueLocation: selectedVenue?.address || (!venueChanged ? originalEvent?.venueLocation : '') || ''
        };
        if (venueChanged) {
            eventData.categories = {};
            eventData.startingPrice = '';
            if (originalEvent?.configurationDraft) {
                eventData.configurationDraft = { ...originalEvent.configurationDraft, category: {} };
            }
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
        originalEvent = { ...originalEvent, ...eventData };
        if (posterInput?.files?.length) {
            const status = document.getElementById('event-draft-status');
            status.textContent = 'Event details saved. Uploading the poster...';
            try {
                await window.tsEvents.uploadPoster(currentEventId, posterInput.files[0], message => {
                    status.textContent = `Event details saved. ${message}`;
                });
            } catch (reason) {
                status.textContent = 'Event details saved. The poster has not been saved; your selected file is kept for retry.';
                const error = new Error(`Your event details were saved, but the poster upload failed. ${reason.message || 'Please retry.'}`);
                error.code = 'poster-upload-failed';
                throw error;
            }
            posterName.textContent = posterInput.files[0].name;
            posterInput.value = '';
            status.textContent = 'Event details and poster saved.';
        }
        return currentEventId;
    };

    document.getElementById('save-event-draft').addEventListener('click', async (e) => {
        e.preventDefault();
        const saveButton = e.currentTarget;
        if (saving) return;
        saving = true;
        saveButton.disabled = true;
        submitBtn.disabled = true;
        try {
            const eventId = await persistDraft();
            if (eventId) {
                window.tsShowToast('Draft saved. You can finish it later.');
                document.getElementById('event-draft-status').textContent = 'Draft saved. Your event is still private and has not been submitted for approval.';
            }
        } catch (err) {
            if (err.code === 'poster-upload-failed') showStep(3);
            window.tsValidation.showGlobalError(document.getElementById(`step-content-${currentStep}`), err.code === 'poster-upload-failed' ? 'Poster could not be saved' : 'Draft could not be saved', err.message);
        } finally {
            saveButton.disabled = false;
            submitBtn.disabled = false;
            saving = false;
        }
    });

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (saving) return;
        saving = true;
        submitBtn.disabled = true;
        document.getElementById('save-event-draft').disabled = true;
        submitBtn.textContent = 'Saving...';
        try {
            const eventId = await persistDraft(true);
            if (eventId) window.location.href = `configuration.php?id=${encodeURIComponent(eventId)}`;
        } catch (err) {
            window.tsValidation.showGlobalError(step3, err.code === 'poster-upload-failed' ? 'Poster could not be saved' : 'Event could not be saved', err.message);
            showStep(3);
        } finally {
            submitBtn.disabled = false;
            document.getElementById('save-event-draft').disabled = false;
            saving = false;
            submitBtn.textContent = 'Continue to Tickets & Rules';
        }
    });
});
