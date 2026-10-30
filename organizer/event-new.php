<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Create Event', 'Build an event in clear steps, then preview and submit it for administrator approval.', '<button class="ts-btn ts-btn-secondary" id="save-event-draft">Save Draft</button>')?>
<p class="small secondary mb-20" id="event-draft-status" role="status" aria-live="polite">Save Draft keeps what you have entered so far. You can finish missing details later.</p>
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
            <button class="ts-btn ts-btn-primary" id="create-event-btn">Continue to Tickets &amp; Rules</button>
        </div>
    </div>
</div>

<script src="<?=ts_asset_url('assets/js/venue-renderer.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/organizer-event-editor.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Create Event', 'create', $content, '..', '');
?>
