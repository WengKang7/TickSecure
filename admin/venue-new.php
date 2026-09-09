<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Add Venue', 'Create the physical venue record before uploading and processing its seating blueprint.', '')?>
<div class="ts-card ts-card-pad" style="max-width:900px">
    <div class="ts-card-title">Venue Information</div>
    <div class="ts-form-grid mt-20" id="venue-form">
        <div class="ts-field span-2"><label class="ts-label">Venue Name</label><input class="ts-input" name="venueName"
                placeholder="e.g. Merdeka Hall"></div>
        <div class="ts-field span-2"><label class="ts-label">Address</label><textarea class="ts-textarea" name="venueAddress"
                placeholder="Full venue address"></textarea></div>
        <div class="ts-field"><label class="ts-label">Seating Capacity</label><input class="ts-input" type="number" name="venueCapacity"
                placeholder="2400"></div>
    </div>
    <div class="ts-alert ts-alert-info mt-24">
        <?=ts_icon('layout')?>
        <div><strong>Next step: seating blueprint</strong>
            <div class="small mt-8">After the venue is created, upload a blueprint so the processing technique can
                identify physical sections for Administrator review.</div>
        </div>
    </div>
    <div class="flex justify-end gap-12 mt-24">
        <a class="ts-btn ts-btn-secondary" href="venues.php">Cancel</a>
        <button id="save-venue-btn" class="ts-btn ts-btn-primary">Next</button>
    </div>
</div>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('venue-form');
    const submitBtn = document.getElementById('save-venue-btn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        V.clearFieldErrors(form);

        const venueNameVal = V.val(form, 'venueName');
        const addressVal = V.val(form, 'venueAddress');
        const capacityVal = V.val(form, 'venueCapacity');

        const ok = V.runAll([
            {
                check: () => {
                    let r = V.validateRequired(venueNameVal, 'Venue Name');
                    if (!r.valid) return r;
                    r = V.validateMinLength(venueNameVal, 3, 'Venue Name');
                    if (!r.valid) return r;
                    return V.validateMaxLength(venueNameVal, 100, 'Venue Name');
                },
                el: V.el(form, 'venueName')
            },
            {
                check: () => {
                    let r = V.validateRequired(addressVal, 'Address');
                    if (!r.valid) return r;
                    r = V.validateMinLength(addressVal, 5, 'Address');
                    if (!r.valid) return r;
                    return V.validateMaxLength(addressVal, 500, 'Address');
                },
                el: V.el(form, 'venueAddress')
            },
            {
                check: () => {
                    let r = V.validateRequired(capacityVal, 'Capacity');
                    if (!r.valid) return r;
                    if (parseInt(capacityVal) <= 0) return { valid: false, error: 'Capacity must be positive' };
                    return { valid: true };
                },
                el: V.el(form, 'venueCapacity')
            }
        ]);
        if (!ok) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        try {
            const newVenueId = await window.tsVenues.createVenue({
                name: venueNameVal,
                address: addressVal,
                capacity: parseInt(capacityVal)
            });
            window.location.href = `venue-layout.php?id=${newVenueId}&step=1`;
        } catch (err) {
            V.showGlobalError(form, 'Error', err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save & Upload Blueprint';
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Add Venue', 'venues', $content, '..', '');
?>