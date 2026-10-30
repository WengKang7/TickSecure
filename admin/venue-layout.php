<?php
require_once __DIR__ . '/../shared/ui.php';
$step = (int)($_GET['step'] ?? 1);
if ($step === 4) $step = 5;
if (!in_array($step, [1, 2, 3, 5], true)) $step = 1;
$activated = ($_GET['activated'] ?? '') === '1';
ob_start();
?>
<?= ts_page_head('Venue seating plan', 'Upload your floor plan, check the seats, then make the venue available to organizers.', '<button class="ts-btn ts-btn-secondary" id="save-layout-draft">Save draft</button>') ?>
<div class="ts-steps ts-simple-steps" aria-label="Venue setup progress">
<?php foreach ([1 => 'Upload floor plan', 3 => 'Review seats', 5 => 'Activate venue'] as $value => $label): ?>
  <div class="ts-step <?= $step === $value ? 'active' : ($step > $value ? 'done' : '') ?>"><span class="ts-step-num"><?= $value === 1 ? 1 : ($value === 3 ? 2 : 3) ?></span><?= $label ?></div>
  <?php if ($value !== 5): ?><span class="ts-step-line"></span><?php endif ?>
<?php endforeach ?>
</div>
<?php if ($step === 1): ?>
<section class="ts-card ts-upload-simple">
  <div class="ts-upload-symbol"><?= ts_icon('upload', 32) ?></div>
  <h2>Start with your floor plan</h2>
  <p class="secondary">We’ll detect the seat boxes and keep their positions, angles and aisles.<br>Seats are numbered left to right, row by row from the stage. Check the result before activating.</p>
  <label class="ts-btn ts-btn-primary mt-20">Choose floor plan<input type="file" hidden id="real-blueprint-file" accept=".png,.pdf,image/png,application/pdf"></label>
  <p class="small secondary mt-12">PNG or PDF · up to 10 MB</p>
  <details class="ts-simple-details mt-24"><summary>Detection settings</summary>
    <div class="ts-scan-options mt-16">
      <label class="ts-seat-tool-field">Plan type<select class="ts-input" id="blueprint-scan-mode"><option value="auto">Detect automatically</option><option value="seats">Individual seat boxes or dots</option><option value="sections">Sections or standing areas</option></select></label>
      <label class="ts-seat-tool-field">Minimum seat size (px)<input class="ts-input" type="number" id="blueprint-min-seat-size" value="5" min="2" max="500"></label>
      <label class="ts-seat-tool-field">Maximum seat size (px)<input class="ts-input" type="number" id="blueprint-max-seat-size" value="80" min="2" max="500"></label>
    </div>
  </details>
  <div id="upload-error" class="ts-alert ts-alert-error mt-16" role="alert" style="display:none"></div>
  <div id="upload-status" class="mt-16" role="status" aria-live="polite" style="display:none"></div>
  <a id="manual-blueprint-review" class="ts-btn ts-btn-secondary mt-16" hidden>Review uploaded plan</a>
</section>
<?php elseif ($step === 2): ?>
<div class="ts-card ts-card-pad"><h2>Opening your floor plan…</h2></div>
<?php elseif ($step === 3): ?>
<div class="ts-plan-filebar ts-card ts-card-pad mb-20">
  <div><?= ts_icon('file') ?> <strong id="blueprint-filename">Uploaded floor plan</strong> <span class="small secondary" id="blueprint-size"></span></div>
  <label class="ts-btn ts-btn-ghost">Replace file<input type="file" hidden data-file-name="blueprint-file" accept=".png,.pdf,image/png,application/pdf"></label>
</div>
<div id="upload-error" class="ts-alert ts-alert-error mb-16" role="alert" style="display:none"></div>
<div id="upload-status" class="mb-16" role="status" aria-live="polite" style="display:none"></div>
<details class="ts-simple-details mb-20"><summary>Scan status & settings</summary>
  <p class="small secondary mt-12" id="blueprint-analysis-status" role="status">Loading detection results…</p>
  <div class="ts-scan-options mt-12">
    <label class="ts-seat-tool-field">Plan type<select class="ts-input" id="blueprint-scan-mode"><option value="auto">Detect automatically</option><option value="seats">Individual seat boxes or dots</option><option value="sections">Sections or standing areas</option></select></label>
    <label class="ts-seat-tool-field">Minimum seat size (px)<input class="ts-input" type="number" id="blueprint-min-seat-size" value="5" min="2" max="500"></label>
    <label class="ts-seat-tool-field">Maximum seat size (px)<input class="ts-input" type="number" id="blueprint-max-seat-size" value="80" min="2" max="500"></label>
  </div>
  <button type="button" class="ts-btn ts-btn-secondary mt-12" id="rescan-blueprint">Detect Seats & Read Labels</button>
</details>
<div class="ts-plan-workspace">
  <section class="ts-card ts-card-pad ts-plan-canvas">
    <h2 class="ts-card-title">Review your seating plan</h2>
    <p class="small secondary mt-8">Seats are numbered automatically from left to right, one row at a time.</p>
    <div id="dynamic-blueprint-boxes" class="ts-generated-board ts-layout-review-board mt-16"></div>
    <details class="ts-simple-details mt-16"><summary>Original floor plan</summary><div id="layout-blueprint-reference" class="ts-blueprint-reference"></div></details>
  </section>
  <aside class="ts-card ts-card-pad ts-plan-sidebar">
    <h2 class="ts-card-title">Check seats & numbering</h2>
    <p class="small secondary mt-8" id="dynamic-sections-sub">Loading seats…</p>
    <div id="dynamic-editor-cards" class="mt-16"></div>
    <details class="ts-simple-details mt-16"><summary>Missing a section?</summary><button type="button" id="add-layout-section" class="ts-btn ts-btn-secondary w-full mt-12">Add section</button></details>
    <p class="small secondary mt-20">Organizers set category names and prices later.</p>
    <a href="venue-layout.php?step=4" class="ts-btn ts-btn-primary w-full mt-16">Review & continue</a>
  </aside>
</div>
<?php elseif ($step === 5 && !$activated): ?>
<div class="ts-plan-workspace">
  <section class="ts-card ts-card-pad"><h2 class="ts-card-title">Final seating plan</h2><div class="ts-generated-board mt-16" id="dynamic-step5-board"></div></section>
  <aside class="ts-card ts-card-pad ts-plan-sidebar">
    <h2 class="ts-card-title">Ready to activate</h2>
    <p class="secondary mt-8">Organizers can reuse this venue and assign ticket categories to its seats.</p>
    <div id="dynamic-activation-summary" class="ts-activation-summary mt-20"></div>
    <p class="small secondary mt-16">Activation creates the physical seat records and locks this layout.</p>
    <a href="venue-layout.php?step=5&activated=1" class="ts-btn ts-btn-primary w-full mt-20" id="step5-activate-btn">Activate venue</a>
    <a href="venue-layout.php?step=3" class="ts-btn ts-btn-ghost w-full mt-12" id="step5-back-btn">Back to review</a>
  </aside>
</div>
<?php elseif ($activated): ?>
<section class="ts-card ts-upload-simple"><div class="ts-upload-symbol"><?= ts_icon('check', 32) ?></div><h2>Venue is ready</h2><p id="activation-success-msg" class="secondary mt-12"></p><div class="flex justify-center gap-12 mt-24"><a class="ts-btn ts-btn-secondary" href="venues.php">All venues</a><a class="ts-btn ts-btn-primary" href="venue-detail.php" id="success-view-venue-btn">View venue</a></div></section>
<?php endif ?>
<script src="<?= ts_asset_url('assets/js/venue-renderer.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/lib/tesseract/tesseract.min.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/blueprint-detection.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-layout-model.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-import.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-shapes.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/blueprint-ocr.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/blueprint-preview.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/seat-map-interactions.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/venue-seat-tools.js', '..') ?>"></script>
<script src="<?= ts_asset_url('assets/js/venue-layout-editor.js', '..') ?>"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
<script type="module">

window.addEventListener('ts-auth-ready', async () => {

    let layoutLocked = false;
    const scanOptions = () => ({ mode: document.getElementById('blueprint-scan-mode')?.value || 'auto', minSize: Number(document.getElementById('blueprint-min-seat-size')?.value || 5), maxSize: Number(document.getElementById('blueprint-max-seat-size')?.value || 80) });

    function renderDynamicUI(data, venueName) {
        window._tsDetectedSections = data;
        const reference = document.getElementById('layout-blueprint-reference');
        if (reference && window._tsBlueprintPreview?.urls) {
            reference.replaceChildren();
            Object.entries(window._tsBlueprintPreview.urls).forEach(([page, url]) => {
                const image = document.createElement('img'); image.src = url; image.alt = `Original floor plan, page ${page}`; reference.appendChild(image);
            });
        }
        window.tsVenueLayoutEditor?.(data, venueName, { cleanLayout: true, backgroundUrls: window._tsBlueprintPreview?.urls, backgroundUrl: window._tsBlueprintPreviewUrl, readOnly: layoutLocked, ...window._tsBlueprintPreviewSize });
    }

    function sectionPayload(data) {
        return data.map(section => ({
            sectionId: section.letter,
            name: section.name.trim(),
            seatCount: Number(section.seats) || 0,
            ...(section.geometry ? { geometry: section.geometry } : {})
        }));
    }

    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('id');
    const requestedStep = parseInt(urlParams.get('step')) || 1;
    const step = requestedStep === 4 ? 5 : requestedStep;
    if (!venueId) return;

    try {
        const venue = await window.tsVenues.getVenue(venueId);
        layoutLocked = ['ACTIVE', 'PROCESSING'].includes(venue.layoutStatus);
        const nameEl = document.getElementById('blueprint-filename');
        const sizeEl = document.getElementById('blueprint-size');
        if (nameEl && sizeEl) {
            const mn = sessionStorage.getItem('mock_pdf_name_'+venueId);
            const ms = sessionStorage.getItem('mock_pdf_size_'+venueId);
            nameEl.textContent = mn || venue.blueprintName || 'blueprint.pdf';
            const fs = ms || venue.blueprintSize || 0;
            const mime = sessionStorage.getItem('blueprint_type_' + venueId) || venue.blueprintMimeType;
            const format = mime === 'image/png' || /\.png$/i.test(nameEl.textContent) ? 'PNG' : 'PDF';
            sizeEl.textContent = fs ? `${format} - ${(fs / (1024 * 1024)).toFixed(2)} MB` : format;
        }

        // Load custom sections from DB if available, otherwise generate defaults based on detected count
        let sectionData = [];
        if (venue.sections && Array.isArray(venue.sections) && venue.sections.length > 0) {
            venue.sections.forEach(s => {
                sectionData.push({
                    id: 'sec-' + s.sectionId,
                    name: s.name,
                    letter: s.sectionId,
                    seats: parseInt(s.seatCount, 10) || 0,
                    ...(s.geometry ? { geometry: s.geometry } : {})
                });
            });
        }
        renderDynamicUI(sectionData, venue.name);
        const analysisStatus = document.getElementById('blueprint-analysis-status');
        if (analysisStatus) {
            const state = venue.blueprintAnalysis?.status;
            analysisStatus.textContent = state === 'NEEDS_REVIEW'
                ? `Detected ${sectionData.reduce((sum, s) => sum + s.seats, 0)} seats in ${sectionData.length} sections. Check positions and numbering before continuing.`
                : state === 'FAILED' ? `OCR needs attention: ${venue.blueprintAnalysis.message}`
                : 'Check the detected seats against the original plan. Use Scan again if seats are missing.';
        }
        const rescanButton = document.getElementById('rescan-blueprint');
        if (rescanButton) {
            rescanButton.disabled = !venue.blueprintUrl || ['ACTIVE', 'PROCESSING'].includes(venue.layoutStatus);
            rescanButton.addEventListener('click', async () => {
                rescanButton.disabled = true;
                let file;
                try {
                    if (!await window.tsDecision('rescanBlueprint', venue.name || 'Venue blueprint', [['Blueprint', venue.blueprintName || 'Current floor plan']])) return;
                    file = await window.tsVenues.readBlueprint(venueId);
                    const result = await window.tsBlueprintOCR.scan(file, message => { analysisStatus.textContent = message; }, scanOptions());
                    await window.tsVenues.saveBlueprintAnalysis(venueId, result);
                    window.location.reload();
                } catch (error) {
                    analysisStatus.textContent = error.message;
                } finally { rescanButton.disabled = false; }
            });
        }
        if (step === 3 && venue.blueprintUrl) {
            try {
                const original = await window.tsVenues.readBlueprint(venueId);
                window._tsBlueprintPreview = await window.tsBlueprintPreview.create(original);
                window._tsBlueprintPreviewSize = window._tsBlueprintPreview.sizes[1];
                renderDynamicUI(sectionData, venue.name);
                window.addEventListener('pagehide', () => window._tsBlueprintPreview.dispose(), { once: true });
            } catch (error) { console.warn('Original image preview is unavailable', error); }
        }

        const saveDraftButton = document.getElementById('save-layout-draft');
        if (step !== 3 || ['ACTIVE', 'PROCESSING'].includes(venue.layoutStatus)) {
            saveDraftButton.style.display = 'none';
        } else {
            saveDraftButton.addEventListener('click', async () => {
                if (window._tsSyncActiveInputs) window._tsSyncActiveInputs();
                const payload = sectionPayload(window._tsDetectedSections || sectionData);
                const total = payload.reduce((sum, section) => sum + section.seatCount, 0);
                if (!payload.length || payload.some(section => !section.sectionId || !section.name || !Number.isSafeInteger(section.seatCount) || section.seatCount < 0 || section.seatCount > 100000)) {
                    alert('Add named sections with whole-number capacities from 0 to 100,000 before saving.');
                    return;
                }
                if (Number(venue.capacity) > 0 && total > Number(venue.capacity)) {
                    alert(`Total seats (${total}) exceeds the venue capacity (${venue.capacity}).`);
                    return;
                }
                saveDraftButton.disabled = true;
                try {
                    await window.tsVenues.updateSections(venueId, payload);
                    window.tsShowToast('Layout draft saved');
                } catch (error) {
                    alert(error.message);
                } finally {
                    saveDraftButton.disabled = false;
                }
            });
        }

        // Share one guarded flow for initial upload and replacement. Do not
        // base64-encode the whole PDF into sessionStorage before uploading it.
        let uploadInProgress = false;
        async function uploadBlueprint(input) {
            if (uploadInProgress || !input.files?.length) return;
            const file = input.files[0];
            const errEl = document.getElementById('upload-error');
            const statusEl = document.getElementById('upload-status');
            const setStatus = message => {
                statusEl.textContent = message;
                statusEl.style.display = 'block';
            };
            errEl.style.display = 'none';
            statusEl.style.display = 'none';
            if (!['image/png', 'application/pdf'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
                errEl.textContent = !['image/png', 'application/pdf'].includes(file.type)
                    ? 'Choose a PNG image or PDF file. Other file formats are not supported.'
                    : file.size < 1 ? 'The selected file is empty. Choose a valid PNG or PDF file.'
                    : 'The selected file exceeds 10 MB. Choose a smaller PNG or PDF file.';
                errEl.style.display = 'block';
                input.value = '';
                return;
            }
            if ((venue.blueprintUrl || venue.blueprintName) && !await window.tsAdminConfirm('replaceBlueprint', venue.name || 'Selected venue', [['Current blueprint', venue.blueprintName || 'Existing blueprint'], ['Replacement file', file.name]])) {
                input.value = '';
                return;
            }
            uploadInProgress = true;
            input.disabled = true;
            let uploaded = false;
            try {
                setStatus('Connecting to storage...');
                await window.tsVenues.uploadBlueprint(venueId, file, setStatus);
                uploaded = true;
                const result = await window.tsBlueprintOCR.scan(file, setStatus, scanOptions());
                setStatus('OCR complete. Saving detected sections for review...');
                await window.tsVenues.saveBlueprintAnalysis(venueId, result);
                try {
                    sessionStorage.removeItem('mock_pdf_' + venueId);
                    sessionStorage.setItem('mock_pdf_name_' + venueId, file.name);
                    sessionStorage.setItem('mock_pdf_size_' + venueId, file.size);
                    sessionStorage.setItem('blueprint_type_' + venueId, file.type);
                } catch (error) { console.warn('Blueprint metadata could not be cached', error); }
                window.location.href = `venue-layout.php?id=${encodeURIComponent(venueId)}&step=3`;
            } catch (error) {
                if (uploaded) {
                    try { await window.tsVenues.failBlueprintAnalysis(venueId, file, error.message); }
                    catch (failure) { console.warn('OCR failure status could not be saved', failure); }
                    errEl.textContent = `File uploaded, but OCR did not complete: ${error.message} Re-upload to retry or open section review to add missing sections manually.`;
                    const reviewLink = document.getElementById('manual-blueprint-review');
                    if (reviewLink) { reviewLink.hidden = false; reviewLink.href = `venue-layout.php?id=${encodeURIComponent(venueId)}&step=3`; }
                } else errEl.textContent = error.message || 'Blueprint upload failed. Please retry.';
                errEl.style.display = 'block';
                statusEl.style.display = 'none';
            } finally {
                uploadInProgress = false;
                input.disabled = false;
                input.value = '';
            }
        }

        // Wire Upload (Step 1)
        const realFileInput = document.getElementById('real-blueprint-file');
        if (realFileInput) {
            realFileInput.addEventListener('change', e => uploadBlueprint(e.target));
        }

        if (step === 2) { window.location.replace(`venue-layout.php?id=${encodeURIComponent(venueId)}&step=3`); }

        // Wire Replace (Step 3)
        const fileInput = document.querySelector('input[data-file-name="blueprint-file"]');
        if (fileInput) {
            fileInput.addEventListener('change', e => uploadBlueprint(e.target));
        }

        // Wire Confirm (Step 3 → 4)
        const btnConfirm = document.querySelector('a[href="venue-layout.php?step=4"]');
        if (btnConfirm) {
            let savingSections = false;
            btnConfirm.addEventListener('click', async (e) => {
                e.preventDefault();
                if (savingSections) return;
                try {
                    if (window._tsSyncActiveInputs) window._tsSyncActiveInputs();
                    const payload = sectionPayload(window._tsDetectedSections || sectionData);
                    const currentTotal = payload.reduce((sum, s) => sum + s.seatCount, 0);
                    if (!payload.length || payload.some(s => !s.name || !Number.isSafeInteger(s.seatCount) || s.seatCount < 1 || s.seatCount > 100000)) {
                        alert('Enter a name and a verified positive whole-number capacity for every section before generating seats. Remove sections that are not in use.');
                        return;
                    }

                    const markerErrors = window.tsSeatLayout?.validate(payload, true) || [];
                    if (markerErrors.length) { alert(markerErrors.join('\n')); return; }
                    if (payload.some(s => s.geometry?.layout === 'ocr' && !s.geometry.reviewed)) {
                        alert('Review and approve each OCR section before generating seats.');
                        return;
                    }

                    // Validation: Ensure total seats do not exceed venue capacity
                    const maxCapacity = parseInt(venue.capacity, 10) || 0;
                    if (maxCapacity > 0 && currentTotal > maxCapacity) {
                        alert(`Total seats (${currentTotal}) exceeds the venue's defined capacity (${maxCapacity}). Please adjust the section seat counts before continuing.`);
                        return;
                    }

                    
                    savingSections = true;
                    btnConfirm.style.pointerEvents = 'none';
                    if (!await window.tsAdminConfirm('confirmSections', venue.name || 'Venue layout', [['Sections', payload.length], ['Physical seats', currentTotal]])) return;
                    await window.tsVenues.updateSections(venueId, payload);
                    window.location.href = `venue-layout.php?id=${venueId}&step=5`;
                } catch(err) { alert(err.message); }
                finally { savingSections = false; btnConfirm.style.pointerEvents = ''; }
            });
        }

        // Wire Activate (Step 5)
        const btnActivate = document.querySelector('#step5-activate-btn');
        if (btnActivate) {
            let activating = false;
            btnActivate.addEventListener('click', async (e) => {
                e.preventDefault();
                if (activating) return;
                const sections = Array.isArray(venue.sections) ? venue.sections : [];
                if (!await window.tsAdminConfirm('activateLayout', venue.name || 'Selected venue', [['Sections', sections.length], ['Physical seats', sections.reduce((sum, section) => sum + (Number(section.seatCount) || 0), 0)]])) return;
                activating = true;
                btnActivate.textContent = 'Activating...';
                btnActivate.style.pointerEvents = 'none';
                try { 
                    await window.tsVenues.activateLayout(venueId); 
                    window.location.href = `venue-layout.php?id=${venueId}&step=5&activated=1`; 
                } catch(err) { 
                    alert(err.message); 
                    btnActivate.textContent = 'Activate Venue Layout';
                    btnActivate.style.pointerEvents = '';
                }
                finally { activating = false; }
            });
        }

        // Fix all navigation links to include venueId
        const step4Back = document.getElementById('step4-back-btn');
        if (step4Back) step4Back.href = `venue-layout.php?id=${venueId}&step=3`;
        const step4Continue = document.getElementById('step4-continue-btn');
        if (step4Continue) step4Continue.href = `venue-layout.php?id=${venueId}&step=5`;
        const step5Back = document.getElementById('step5-back-btn');
        if (step5Back) step5Back.href = `venue-layout.php?id=${venueId}&step=3`;

        // Populate activation success page
        const successVenueName = document.getElementById('dynamic-success-venue-name');
        if (successVenueName) successVenueName.textContent = venue.name || 'Venue';
        const successMsg = document.getElementById('activation-success-msg');
        if (successMsg) successMsg.textContent = `${venue.name || 'This venue'} is now available for Event Organizers to select when creating new events.`;
        const successSections = document.getElementById('dynamic-success-sections');
        if (successSections) {
            const secs = Array.isArray(venue.sections) ? venue.sections : [];
            successSections.textContent = secs.length;
        }
        const successSeats = document.getElementById('dynamic-success-seats');
        if (successSeats) {
            const secs = Array.isArray(venue.sections) ? venue.sections : [];
            let total = 0;
            secs.forEach(s => { total += (parseInt(s.seatCount, 10) || 0); });
            successSeats.textContent = total;
        }
        const viewVenueBtn = document.getElementById('success-view-venue-btn');
        if (viewVenueBtn) viewVenueBtn.href = `venue-detail.php?id=${venueId}`;

    } catch (err) { console.error(err); }
});
</script>

<?php

$content = ob_get_clean();

render_dashboard_page(
    'admin',
    'Venue seating plan',
    'venues',
    $content,
    '..',
    ''
);

?>
