<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Administrator Profile', 'Manage your Administrator account details and security settings.', '<button class="ts-btn ts-btn-primary" data-toast="Administrator profile saved">Save Changes</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Profile Information</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input"
                    value="System Administrator"></div>
            <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input"
                    value="admin@ticksecure.local"></div>
            <div class="ts-field"><label class="ts-label">Role</label><input class="ts-input" value="Administrator"
                    disabled></div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Security</div>
        <div class="flex justify-between items-center mt-20"><span>Account
                Status</span><?=ts_status('Active', 'success')?>
        </div>
        <div class="flex justify-between items-center mt-16"><span>Email
                Verification</span><?=ts_status('Verified', 'success')?>
        </div><a class="ts-btn ts-btn-secondary w-full mt-20" href="../auth/reset-password.php">Change Password</a>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Administrator Profile', 'profile', $content, '..', '');
?>