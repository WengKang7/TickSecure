<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Organization Profile', 'Manage organization-specific information while shared account identity remains inherited from your TickSecure user account.', '<button class="ts-btn ts-btn-primary" data-toast="Organization profile saved">Save Changes</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Shared User Identity</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input" value="Nicholas Tan">
            </div>
            <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input"
                    value="nicholas@novastage.my"></div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="flex justify-between items-center">
            <div class="ts-card-title">Approval Status</div>
            <?=ts_status('Approved', 'success')?>
        </div>
        <p class="secondary mt-16">Your organization is approved to create and submit events. Approval status is managed
            by the Administrator.</p>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Approved Date</div>
            <div class="ts-detail-value">02 Jun 2026</div>
        </div>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Organization Information</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field"><label class="ts-label">Organization Name</label><input class="ts-input"
                value="Nova Stage Entertainment"></div>
        <div class="ts-field"><label class="ts-label">Organization Phone</label><input class="ts-input"
                value="+60 3-8899 2233"></div>
        <div class="ts-field span-2"><label class="ts-label">Organization Description</label><textarea
                class="ts-textarea">Premium event production and live entertainment organizer based in Kuala Lumpur.</textarea>
        </div>
        <div class="ts-field span-2"><label class="ts-label">Organization Address</label><input class="ts-input"
                value="Bukit Bintang, Kuala Lumpur"></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Organization Profile', 'profile', $content, '..', '');
?>