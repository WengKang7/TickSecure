<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1050px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Account</div>
                <h1 class="ts-section-title">Profile & Security</h1>
                <p class="ts-section-copy">Manage personal information, password security and connected wallet status.
                </p>
            </div><button class="ts-btn ts-btn-primary" id="btn-save">Save Changes</button>
        </div>
        <div class="ts-grid-2">
            <div class="ts-card ts-card-pad" id="profile-form-container">
                <div class="ts-card-title">Personal Information</div>
                <div class="ts-auth-fields mt-20" id="profile-form">
                    <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input"
                            name="fullName" id="val-fullname" value=""></div>
                    <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input"
                            id="val-email" value="" readonly style="background-color:#f8f9fa"></div>
                    <div class="ts-alert" id="email-verification-alert">
                        <?=ts_icon('mail')?>
                        Checking email verification...</div>
                </div>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Connected Wallet</div>
                <div class="ts-wallet-card mt-20">
                    <div><strong id="val-wallet-name">MetaMask</strong>
                        <div class="ts-wallet-id mt-8" id="val-wallet-id">Loading...</div>
                    </div>
                    <div id="val-wallet-status"></div>
                </div><button class="ts-btn ts-btn-secondary w-full mt-16" id="btn-wallet-action">Loading...</button>
                <div class="small muted mt-12">Wallet ownership is shown separately from personal identity information.
                </div>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Password & Security</div>
                <p class="secondary">Update your account password and review account security status.</p><a
                    class="ts-btn ts-btn-secondary" href="../auth/reset-password.php">Change Password</a>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Account Status</div>
                <div class="flex justify-between items-center mt-20"><span>Buyer
                        Account</span><span id="account-status-chip">Checking...</span>
                </div>
                <div class="flex justify-between items-center mt-16"><span>Email
                        Verification</span><span id="email-status-chip">Checking...</span>
                </div>
            </div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const p = await window.tsUsers.getCurrentProfile();
        const curUser = window.tsCurrentUser;
        
        document.getElementById('val-fullname').value = p.fullName || curUser.fullName || '';
        document.getElementById('val-email').value = p.email || curUser.email || '';

        const verified = p.emailVerified === true;
        const emailAlert = document.getElementById('email-verification-alert');
        emailAlert.className = `ts-alert ${verified ? 'ts-alert-success' : 'ts-alert-warning'}`;
        emailAlert.innerHTML = verified
            ? 'Email verified'
            : 'Email verification is required before ticket actions are available.';
        document.getElementById('account-status-chip').innerHTML = `<span class="ts-chip ts-chip-${p.status === 'active' ? 'success' : 'warning'}">${p.status || 'Unknown'}</span>`;
        document.getElementById('email-status-chip').innerHTML = verified
            ? '<span class="ts-chip ts-chip-success">Verified</span>'
            : '<span class="ts-chip ts-chip-warning">Not verified</span>';
        
        const walletId = p.walletAddress || curUser.walletAddress;
        if (walletId) {
            document.getElementById('val-wallet-id').textContent = walletId;
            document.getElementById('val-wallet-status').innerHTML = `<span class="ts-chip ts-chip-success">Connected</span>`;
            document.getElementById('btn-wallet-action').textContent = 'Change Wallet';
        } else {
            document.getElementById('val-wallet-id').textContent = 'Not connected';
            document.getElementById('val-wallet-status').innerHTML = `<span class="ts-chip ts-chip-warning">Required</span>`;
            document.getElementById('btn-wallet-action').textContent = 'Connect Wallet';
        }
        
        document.getElementById('btn-wallet-action').addEventListener('click', () => {
            window.location.href = 'wallet.php';
        });
        
        const btnSave = document.getElementById('btn-save');
        const form = document.getElementById('profile-form');
        
        btnSave.addEventListener('click', async (e) => {
            e.preventDefault();
            const V = window.tsValidation;
            V.clearFieldErrors(form);
            
            const ok = V.runAll([
                {
                    check: () => {
                        const v = V.val(form, 'fullName');
                        let r = V.validateRequired(v, 'Full Name');
                        if (!r.valid) return r;
                        return V.validateMinLength(v, 3, 'Full Name');
                    },
                    el: V.el(form, 'fullName')
                }
            ]);
            
            if (!ok) return;
            
            btnSave.disabled = true;
            btnSave.textContent = 'Saving...';
            
            try {
                await window.tsUsers.updateProfile(curUser.uid, {
                    fullName: V.val(form, 'fullName')
                });
                V.showGlobalSuccess(document.getElementById('profile-form-container'), 'Profile updated successfully.');
            } catch (err) {
                V.showGlobalError(document.getElementById('profile-form-container'), 'Error', err.message);
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = 'Save Changes';
            }
        });
        
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Buyer Profile', 'tickets', $content, '..', true);
?>
