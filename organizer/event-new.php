<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Create Event', 'Build an event in clear steps, then preview and submit it for administrator approval.', '<button class="ts-btn ts-btn-secondary" data-toast="Draft saved in UI preview">Save Draft</button>')?>
<div class="ts-steps">
    <div class="ts-step active"><span class="ts-step-num">1</span>Basic Info</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">2</span>Venue</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">3</span>Media</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">4</span>Tickets</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">5</span>Rules</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">6</span>Review</div>
</div>
<div class="ts-card ts-card-pad">
    <div class="ts-card-title">Step 1 · Basic Information</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field span-2"><label class="ts-label">Event Name</label><input class="ts-input"
                placeholder="e.g. Aurora After Dark"></div>
        <div class="ts-field span-2"><label class="ts-label">Event Description</label><textarea class="ts-textarea"
                placeholder="Describe the concert experience and key information buyers should know."></textarea></div>
        <div class="ts-field"><label class="ts-label">Event Category</label><select class="ts-select">
                <option>Concert</option>
                <option>Festival</option>
                <option>Live Performance</option>
            </select></div>
        <div class="ts-field"><label class="ts-label">Event Date</label><input class="ts-input" type="date"></div>
        <div class="ts-field"><label class="ts-label">Start Time</label><input class="ts-input" type="time"></div>
        <div class="ts-field"><label class="ts-label">Organizer</label><input class="ts-input"
                value="Nova Stage Entertainment" disabled></div>
    </div>
    <div class="ts-divider"></div>
    <div class="ts-card-title">Step 2 · Venue</div>
    <div class="ts-grid-2 mt-20">
        <div class="ts-field"><label class="ts-label">Select Administrator-managed Venue</label><select
                class="ts-select">
                <option>Merdeka Hall · Kuala Lumpur</option>
                <option>Axiata Arena · Bukit Jalil</option>
            </select>
            <div class="ts-help">Only venues with an active processed layout are available.</div>
        </div>
<div class="ts-venue-layout-shell mt-20">

    <div class="ts-venue-layout-board">

        <div class="ts-venue-layout-stage">
            STAGE
        </div>

        <div
            class="ts-venue-zone"
            style="left:8%; top:150px; width:34%; height:145px;"
        >
            <div class="ts-venue-zone-content">
                <div class="ts-venue-zone-title">Section A</div>
                <div class="ts-venue-zone-sub">20 seats</div>
            </div>
        </div>

        <div
            class="ts-venue-zone"
            style="right:8%; top:150px; width:34%; height:145px;"
        >
            <div class="ts-venue-zone-content">
                <div class="ts-venue-zone-title">Section B</div>
                <div class="ts-venue-zone-sub">40 seats</div>
            </div>
        </div>

        <div
            class="ts-venue-zone"
            style="left:18%; right:18%; bottom:52px; height:140px;"
        >
            <div class="ts-venue-zone-content">
                <div class="ts-venue-zone-title">Section C</div>
                <div class="ts-venue-zone-sub">60 seats</div>
            </div>
        </div>

    </div>

    <div class="ts-venue-layout-panel">

        <h3>Venue Layout</h3>
        <p class="small muted">This is the approved venue layout prepared by the Administrator.</p>

        <div class="ts-section-card">
            <div class="ts-section-card-title">Section A</div>
            <div class="small muted">20 seats</div>
        </div>

        <div class="ts-section-card">
            <div class="ts-section-card-title">Section B</div>
            <div class="small muted">40 seats</div>
        </div>

        <div class="ts-section-card">
            <div class="ts-section-card-title">Section C</div>
            <div class="small muted">60 seats</div>
        </div>

    </div>

</div>
    </div>
    <div class="ts-divider"></div>
    <div class="ts-card-title">Step 3 · Promotional Media</div><label class="ts-dropzone mt-20">

        <input type="file" style="display:none">

        <span class="ts-drop-icon">
            <?=ts_icon('upload')?>
        </span>

        <strong>
            Upload event poster
        </strong>

        <div class="small muted mt-8">
            PNG or JPG · recommended portrait artwork
        </div>

    </label>
    <div class="flex justify-end mt-24"><a class="ts-btn ts-btn-primary" href="configuration.php">Continue to Ticket
            Configuration</a></div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Create Event', 'create', $content, '..', '');
?>