<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Administrator Profile', 'Manage your Administrator account details and security settings.', '<button id="btn-save" class="ts-btn ts-btn-primary">Save Changes</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Profile Information</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Full Name</label><input id="inp-name" class="ts-input"
                    value=""></div>
            <div class="ts-field"><label class="ts-label">Email</label><input id="inp-email" class="ts-input"
                    value="" disabled></div>
            <div class="ts-field"><label class="ts-label">Role</label><input id="inp-role" class="ts-input" value=""
                    disabled></div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Security</div>
        <div class="flex justify-between items-center mt-20"><span>Account Status</span><div id="val-status"></div>
        </div>
        <div class="flex justify-between items-center mt-16"><span>Email Verification</span><div id="val-verified"></div>
        </div><a class="ts-btn ts-btn-secondary w-full mt-20" href="../auth/reset-password.php">Change Password</a>
    </div>
</div>

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