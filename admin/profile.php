<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-profile-page ts-profile-staff">
    <?=ts_profile_page_head('Administrator Profile', 'Manage your profile picture, account details and password.', 'Administrator')?>
    <div class="ts-profile-layout">
        <div class="ts-profile-column">
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Personal information', 'Keep your administrator profile up to date.', 'user')?>
                <?=ts_profile_photo()?>
                <div class="ts-auth-fields ts-profile-fields">
                    <div class="ts-field"><label class="ts-label" for="inp-name">Full name</label><input id="inp-name" class="ts-input" autocomplete="name" value=""></div>
                    <div class="ts-field"><label class="ts-label" for="inp-email">Email address</label><input id="inp-email" class="ts-input" value="" disabled></div>
                    <div class="ts-field"><label class="ts-label" for="inp-role">Account role</label><input id="inp-role" class="ts-input" value="" disabled></div>
                </div>
                <div class="ts-profile-card-footer"><span class="small muted">Your account role is managed by the system.</span><button id="btn-save" class="ts-btn ts-btn-primary" type="button">Save Changes</button></div>
            </section>
        </div>
        <div class="ts-profile-column">
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Password &amp; security', 'Use your current password to choose a new one.', 'lock')?>
                <?=ts_profile_password_form()?>
            </section>
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Account status', 'Review your account and email verification.', 'shield')?>
                <dl class="ts-profile-status-list">
                    <div><dt>Account status</dt><dd id="val-status">Checking...</dd></div>
                    <div><dt>Email verification</dt><dd id="val-verified">Checking...</dd></div>
                </dl>
            </section>
        </div>
    </div>
</div>

<?=ts_profile_assets()?>
<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const uid = window.tsCurrentUser.uid;
        const profile = await window.tsUsers.getUser(uid);
        
        if (profile) {
            document.getElementById('inp-name').value = profile.fullName || '';
            document.getElementById('inp-email').value = profile.email || '';
            document.getElementById('inp-role').value = profile.role || 'Administrator';
            
            let statTone = profile.status === 'active' ? 'success' : 'warning';
            document.getElementById('val-status').innerHTML = `<span class="ts-chip ts-chip-${statTone}">${profile.status || 'Active'}</span>`;
            document.getElementById('val-verified').innerHTML = profile.emailVerified ? `<span class="ts-chip ts-chip-success">Verified</span>` : `<span class="ts-chip ts-chip-neutral">Unverified</span>`;
        }
        
        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                btnSave.disabled = true;
                btnSave.textContent = 'Saving...';
                try {
                    await window.tsUsers.updateProfile(uid, { fullName: document.getElementById('inp-name').value });
                    alert('Profile saved successfully.');
                } catch(err) {
                    alert('Error saving profile: ' + err.message);
                }
                btnSave.disabled = false;
                btnSave.textContent = 'Save Changes';
            });
        }
        
    } catch(e) {
        console.error(e);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Administrator Profile', 'profile', $content, '..', '');
?>