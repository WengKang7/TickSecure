<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight ts-profile-page ts-profile-buyer">
    <div class="ts-container ts-profile-container">
        <?=ts_profile_page_head('Profile &amp; Security', 'Manage your personal details, profile picture and account security.', 'Buyer')?>
        <div class="ts-profile-layout">
            <div class="ts-profile-column">
                <section class="ts-card ts-settings-card" id="profile-form-container">
                    <?=ts_profile_card_head('Personal information', 'Keep your name and profile picture up to date.', 'user')?>
                    <?=ts_profile_photo()?>
                    <div class="ts-auth-fields ts-profile-fields" id="profile-form">
                        <div class="ts-field"><label class="ts-label" for="val-fullname">Full name</label><input class="ts-input" name="fullName" id="val-fullname" autocomplete="name" value=""></div>
                        <div class="ts-field"><label class="ts-label" for="val-email">Email address</label><input class="ts-input" id="val-email" value="" readonly></div>
                        <div class="ts-alert" id="email-verification-alert"><?=ts_icon('mail')?>Checking email verification...</div>
                    </div>
                    <div class="ts-profile-card-footer"><span class="small muted">Your email address is linked to your sign-in.</span><button class="ts-btn ts-btn-primary" id="btn-save" type="button">Save Changes</button></div>
                </section>
                <section class="ts-card ts-settings-card">
                    <?=ts_profile_card_head('Connected wallet', 'Manage the wallet used for your ticket NFTs.', 'wallet')?>
                    <div class="ts-profile-wallet">
                        <div><strong id="val-wallet-name">MetaMask</strong><div class="ts-wallet-id" id="val-wallet-id">Loading...</div></div>
                        <div id="val-wallet-status"></div>
                    </div>
                    <div class="ts-profile-card-footer"><span class="small muted">Wallet ownership is separate from your profile details.</span><button class="ts-btn ts-btn-secondary" id="btn-wallet-action" type="button">Loading...</button></div>
                </section>
            </div>
            <div class="ts-profile-column">
                <section class="ts-card ts-settings-card">
                    <?=ts_profile_card_head('Password &amp; security', 'Use your current password to choose a new one.', 'lock')?>
                    <?=ts_profile_password_form()?>
                </section>
                <section class="ts-card ts-settings-card">
                    <?=ts_profile_card_head('Account status', 'Your account and email verification at a glance.', 'shield')?>
                    <dl class="ts-profile-status-list">
                        <div><dt>Buyer account</dt><dd id="account-status-chip">Checking...</dd></div>
                        <div><dt>Email verification</dt><dd id="email-status-chip">Checking...</dd></div>
                    </dl>
                </section>
            </div>
        </div>
    </div>
</main>

<?=ts_profile_assets()?>
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
render_public_page('Buyer Profile', 'profile', $content, '..', true);
?>
