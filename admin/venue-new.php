<?php
require_once __DIR__ . '/../shared/ui.php';
require_once __DIR__ . '/../api/venue-geocoding-service.php';
$mapsConfig = venue_map_config();
ob_start();
?>

<?=ts_page_head('Add Venue', 'Create the physical venue record before uploading and processing its seating blueprint.', '')?>
<div class="ts-card ts-card-pad" style="max-width:900px">
    <div class="ts-card-title">Venue Information</div>
    <section class="ts-venue-location mt-20" aria-labelledby="venue-location-heading">
        <h2 id="venue-location-heading" class="ts-card-title">Find your venue</h2>
        <p class="small">Search for a venue or address, then choose a result. You can also click the map or drag the pin to set the exact location.</p>
        <div class="ts-venue-location-search">
            <label class="ts-sr-only" for="venue-location-query">Search venue or address</label>
            <input id="venue-location-query" class="ts-input" type="search" placeholder="e.g. Merdeka Hall, Kuala Lumpur" maxlength="200">
            <button id="venue-location-search" type="button" class="ts-btn ts-btn-secondary">Search</button>
        </div>
        <p id="venue-location-status" class="small" role="status" aria-live="polite">Loading map… You can also enter the venue details below.</p>
        <div id="venue-location-results" class="ts-venue-location-results" aria-label="Location search results" hidden></div>
        <div id="venue-location-map" class="ts-venue-location-map" aria-label="Venue location map" data-tile-url="<?=htmlspecialchars($mapsConfig['tileUrl'], ENT_QUOTES)?>" data-endpoint="../api/venue-geocoding.php"></div>
        <div class="ts-venue-location-caption">
            <span id="venue-location-coordinates">No location selected</span>
            <button id="venue-location-clear" class="ts-btn ts-btn-ghost" type="button" hidden>Clear pin</button>
        </div>
        <p class="small">Review the suggested name and address before continuing. For unnamed places, the nearest address may be suggested; you can enter the venue name yourself. Search only for public venues. Location data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>.</p>
    </section>
    <div class="ts-form-grid mt-20" id="venue-form">
        <div class="ts-field span-2"><label class="ts-label" for="venue-name">Venue Name</label><input id="venue-name" class="ts-input" name="venueName"
                maxlength="100" placeholder="e.g. Merdeka Hall"></div>
        <div class="ts-field span-2"><label class="ts-label" for="venue-address">Address</label><textarea id="venue-address" class="ts-textarea" name="venueAddress"
                maxlength="500" placeholder="Full venue address"></textarea></div>
    </div>
    
    <div class="flex justify-end gap-12 mt-24">
        <a class="ts-btn ts-btn-secondary" href="venues.php">Cancel</a>
        <button id="save-venue-btn" class="ts-btn ts-btn-primary">Next</button>
    </div>
</div>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script src="<?=htmlspecialchars(ts_asset_url('assets/js/venue-location.js', '..'), ENT_QUOTES)?>" defer></script>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('venue-form');
    const submitBtn = document.getElementById('save-venue-btn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        V.clearFieldErrors(form);
        if (window.tsVenueLocation?.isBusy()) {
            V.showGlobalError(form, 'Finding location', 'Wait for the location lookup to finish before continuing.');
            return;
        }

        const venueNameVal = V.val(form, 'venueName');
        const addressVal = V.val(form, 'venueAddress');

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
            }
        ]);
        if (!ok) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        try {
            const newVenueId = await window.tsVenues.createVenue({
                name: venueNameVal,
                address: addressVal,
                capacity: 0,
                location: window.tsVenueLocation?.getSelection() || null
            });
            window.location.href = `venue-layout.php?id=${newVenueId}&step=1`;
        } catch (err) {
            V.showGlobalError(form, 'Error', err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Next';
        }
    });
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Add Venue', 'venues', $content, '..', '');
?>
