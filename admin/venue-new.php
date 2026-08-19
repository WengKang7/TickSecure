<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Add Venue', 'Create the physical venue record before uploading and processing its seating blueprint.', '')?>
<div class="ts-card ts-card-pad" style="max-width:900px">
    <div class="ts-card-title">Venue Information</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field span-2"><label class="ts-label">Venue Name</label><input class="ts-input"
                placeholder="e.g. Merdeka Hall"></div>
        <div class="ts-field span-2"><label class="ts-label">Address</label><textarea class="ts-textarea"
                placeholder="Full venue address"></textarea></div>
        <div class="ts-field"><label class="ts-label">Seating Capacity</label><input class="ts-input" type="number"
                placeholder="2400"></div>
    </div>
    <div class="ts-alert ts-alert-info mt-24">
        <?=ts_icon('layout')?>
        <div><strong>Next step: seating blueprint</strong>
            <div class="small mt-8">After the venue is created, upload a blueprint so the processing technique can
                identify physical sections for Administrator review.</div>
        </div>
    </div>
    <div class="flex justify-end gap-12 mt-24"><a class="ts-btn ts-btn-secondary" href="venues.php">Cancel</a><a
            class="ts-btn ts-btn-primary" href="venue-layout.php">Save & Upload Blueprint</a></div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Add Venue', 'venues', $content, '..', '');
?>