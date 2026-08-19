<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Northlight Events', 'Organizer application submitted by Amelia Wong on 18 Aug 2026.', '<button class="ts-btn ts-btn-danger" data-modal-open="confirm-modal">Reject</button> <button class="ts-btn ts-btn-success" data-modal-open="confirm-modal">Approve Organizer</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Applicant Identity</div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Full Name</div>
            <div class="ts-detail-value">Amelia Wong</div>
        </div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Email</div>
            <div class="ts-detail-value">amelia@northlight.my</div>
        </div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Email Verification</div>
            <div class="ts-detail-value">
                <?=ts_status('Verified', 'success')?>
            </div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Organization Profile</div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Organization Name</div>
            <div class="ts-detail-value">Northlight Events</div>
        </div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Phone</div>
            <div class="ts-detail-value">+60 12-884 5522</div>
        </div>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Address</div>
            <div class="ts-detail-value">Petaling Jaya, Selangor</div>
        </div>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Organization Description</div>
    <p class="secondary">Independent live-events production team specializing in music showcases and curated concert
        experiences across Klang Valley venues.</p>
</div>
<div class="ts-alert ts-alert-info mt-24">
    <?=ts_icon('shield')?>
    <div><strong>Decision is audit-sensitive</strong>
        <div class="small mt-8">Approval or rejection will be recorded with Administrator identity, date/time and
            outcome. Rejection requires a reason.</div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Organizer Application', 'organizers', $content, '..', '');
?>