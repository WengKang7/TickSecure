<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Create Event', 'Build an event in clear steps, then preview and submit it for administrator approval.', '<button class="ts-btn ts-btn-secondary" data-toast="Draft saved in UI preview">Save Draft</button>')?>
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
                    name="eventName" id="eventName" placeholder="e.g. Aurora After Dark"></div>
            <div class="ts-field span-2"><label class="ts-label">Event Description</label><textarea class="ts-textarea"
                    name="eventDescription" id="eventDescription" placeholder="Describe the concert experience and key information buyers should know."></textarea></div>
            <div class="ts-field"><label class="ts-label">Event Category</label><select class="ts-select" name="eventCategory" id="eventCategory">
                    <option value="">Select category...</option>
                    <option value="Concert">Concert</option>
                    <option value="Festival">Festival</option>
                    <option value="Live Performance">Live Performance</option>
                </select></div>
            <div class="ts-field"><label class="ts-label">Event Date</label><input class="ts-input" type="date" name="eventDate" id="eventDate"></div>
            <div class="ts-field"><label class="ts-label">Start Time</label><input class="ts-input" type="time" name="eventTime" id="eventTime"></div>
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
            <select class="ts-select" id="venue-select" name="venueId">
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
            <input type="file" id="poster-upload" accept="image/png, image/jpeg" style="display:none">
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

    document.getElementById('btn-next-1').addEventListener('click', (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        V.clearFieldErrors(document);
        const ok = V.runAll([
            {
                check: () => {
                    const v = V.val(document, 'eventName');
                    let r = V.validateRequired(v, 'Event Name');
                    if (!r.valid) return r;
                    r = V.validateMinLength(v, 3, 'Event Name');
                    if (!r.valid) return r;
                    return V.validateMaxLength(v, 200, 'Event Name');
                },
                el: V.el(document, 'eventName')
            },
            {
                check: () => {
                    const v = V.val(document, 'eventDescription');
                    let r = V.validateRequired(v, 'Description');
                    if (!r.valid) return r;
                    r = V.validateMinLength(v, 10, 'Description');
                    if (!r.valid) return r;
                    return V.validateMaxLength(v, 5000, 'Description');
                },
                el: V.el(document, 'eventDescription')
            },
            { check: () => V.validateRequired(V.val(document, 'eventCategory'), 'Category'), el: V.el(document, 'eventCategory') },
            {
                check: () => {
                    const v = V.val(document, 'eventDate');
                    let r = V.validateRequired(v, 'Event Date');
                    if (!r.valid) return r;
                    const date = new Date(v);
                    if (date < new Date(new Date().setHours(0,0,0,0))) return { valid: false, error: 'Event Date must be in the future.' };
                    return { valid: true };
                },
                el: V.el(document, 'eventDate')
            },
            { check: () => V.validateRequired(V.val(document, 'eventTime'), 'Start Time'), el: V.el(document, 'eventTime') }
        ]);
        if (ok) showStep(2);
    });

    document.getElementById('btn-prev-2').addEventListener('click', (e) => { e.preventDefault(); showStep(1); });
    
    document.getElementById('btn-next-2').addEventListener('click', (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        V.clearFieldErrors(document);
        const ok = V.runAll([
            { check: () => V.validateRequired(venueSelect.value, 'Venue'), el: venueSelect }
        ]);
        if (ok) showStep(3);
    });

    document.getElementById('btn-prev-3').addEventListener('click', (e) => { e.preventDefault(); showStep(2); });
    
    // UI for poster upload
    if (posterInput && posterName) {
        posterInput.addEventListener('change', () => {
            if (posterInput.files && posterInput.files.length > 0) {
                posterName.textContent = posterInput.files[0].name;
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
        } catch(e) {
            console.error('Failed to load initial data', e);
        }
    });

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        V.clearFieldErrors(document);
        
        // Final sanity check
        if (!venueSelect.value) return showStep(2);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        try {
            const selectedVenue = venuesData.find(v => v.id === venueSelect.value);
            const newEventId = await window.tsEvents.createEvent({
                name: V.val(document, 'eventName'),
                description: V.val(document, 'eventDescription'),
                category: V.val(document, 'eventCategory'),
                date: V.val(document, 'eventDate'),
                time: V.val(document, 'eventTime'),
                venueId: venueSelect.value,
                venueName: selectedVenue ? selectedVenue.name : ''
            });

            if (posterInput && posterInput.files && posterInput.files.length > 0) {
                submitBtn.textContent = 'Uploading media (Please wait up to 10s)...';
                console.log('Starting upload for event ID:', newEventId);
                try {
                    await Promise.race([
                        window.tsEvents.uploadPoster(newEventId, posterInput.files[0]),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timed out after 10 seconds. Firebase Storage may be blocking the request.')), 10000))
                    ]);
                    console.log('Upload successful!');
                } catch (uploadErr) {
                    console.error('Poster upload failed:', uploadErr);
                    alert('Event created successfully, but poster upload failed: ' + uploadErr.message + '\n\nYou can upload it later. Proceeding to Ticket Configuration...');
                }
            }

            console.log('Redirecting to configuration.php?id=' + newEventId);
            window.location.href = `configuration.php?id=${newEventId}`;
        } catch (err) {
            console.error('Outer create event catch:', err);
            V.showGlobalError(document.getElementById('step-content-3'), 'Creation Failed', err.message);
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