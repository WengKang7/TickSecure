<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-profile-page ts-profile-staff">
    <?=ts_profile_page_head('Organization Profile', 'Manage your profile picture, organization details and account security.', 'Organizer')?>
    <div class="ts-profile-layout">
        <div class="ts-profile-column">
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Your account', 'Your profile picture and registered account details.', 'user')?>
                <?=ts_profile_photo()?>
                <div class="ts-auth-fields ts-profile-fields">
                    <div class="ts-field"><label class="ts-label" for="sharedName">Full name</label><input class="ts-input" id="sharedName" disabled></div>
                    <div class="ts-field"><label class="ts-label" for="sharedEmail">Email address</label><input class="ts-input" id="sharedEmail" disabled></div>
                </div>
            </section>
            <section class="ts-card ts-settings-card" id="org-profile-form">
                <?=ts_profile_card_head('Organization information', 'Update the details used for your organizer account.', 'layout')?>
                <div class="ts-profile-organization-fields">
                    <div class="ts-field"><label class="ts-label" for="orgName">Organization name</label><input class="ts-input" id="orgName" name="orgName"></div>
                    <div class="ts-field"><label class="ts-label" for="orgPhone">Phone number</label><input class="ts-input" id="orgPhone" name="orgPhone" autocomplete="tel"></div>
                    <div class="ts-field ts-profile-full"><label class="ts-label" for="orgDesc">Organization description</label><textarea class="ts-textarea" id="orgDesc" name="orgDesc" rows="4"></textarea></div>
                    <div class="ts-field ts-profile-full"><label class="ts-label" for="orgAddress">Organization address</label><input class="ts-input" id="orgAddress" name="orgAddress" autocomplete="street-address"></div>
                </div>
                <div class="ts-profile-card-footer"><span class="small muted">Save after editing your organization details.</span><button class="ts-btn ts-btn-primary" id="save-profile-btn" type="button">Save Changes</button></div>
            </section>
        </div>
        <div class="ts-profile-column">
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Password &amp; security', 'Use your current password to choose a new one.', 'lock')?>
                <?=ts_profile_password_form()?>
            </section>
            <section class="ts-card ts-settings-card">
                <?=ts_profile_card_head('Approval status', 'Organizer approval is managed by the administrator.', 'shield')?>
                <dl class="ts-profile-status-list">
                    <div><dt>Current status</dt><dd id="org-status-chip">Checking...</dd></div>
                    <div><dt>Approved date</dt><dd id="org-approved-date">-</dd></div>
                </dl>
            </section>
        </div>
    </div>
</div>

<?=ts_profile_assets()?>
<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const uid = window.tsCurrentUser?.uid;
        if(!uid) return;

        document.getElementById('sharedName').value = window.tsCurrentUser.fullName || '';
        document.getElementById('sharedEmail').value = window.tsCurrentUser.email || '';

        const profile = await window.tsUsers.getOrganizerProfile(uid);
        if(profile) {
            document.getElementById('orgName').value = profile.organizationName || '';
            document.getElementById('orgDesc').value = profile.organizationDescription || '';
            document.getElementById('orgPhone').value = profile.organizationPhone || '';
            document.getElementById('orgAddress').value = profile.organizationAddress || '';
            
            const accountStatus = String(window.tsCurrentUser?.status || 'pending').toUpperCase();
            const tone = accountStatus === 'ACTIVE' ? 'success' : (accountStatus === 'REJECTED' ? 'error' : 'warning');
            document.getElementById('org-status-chip').innerHTML = `<span class="ts-chip ts-chip-${tone}">${esc(accountStatus)}</span>`;
            const accountUpdatedAt = window.tsCurrentUser?.updatedAt || '';
            document.getElementById('org-approved-date').textContent = accountStatus === 'ACTIVE' && accountUpdatedAt
                ? new Date(accountUpdatedAt).toLocaleDateString()
                : '-';
        }
        
        document.getElementById('save-profile-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const V = window.tsValidation;
            const form = document.getElementById('org-profile-form');
            V.clearFieldErrors(form);
            const ok = V.runAll([
                {
                    check: () => {
                        const v = V.val(form, 'orgName');
                        let r = V.validateRequired(v, 'Name');
                        if (!r.valid) return r;
                        r = V.validateMinLength(v, 3, 'Name');
                        if (!r.valid) return r;
                        return V.validateMaxLength(v, 200, 'Name');
                    },
                    el: V.el(form, 'orgName')
                },
                {
                    check: () => {
                        const v = V.val(form, 'orgDesc');
                        let r = V.validateRequired(v, 'Description');
                        if (!r.valid) return r;
                        r = V.validateMinLength(v, 10, 'Description');
                        if (!r.valid) return r;
                        return V.validateMaxLength(v, 2000, 'Description');
                    },
                    el: V.el(form, 'orgDesc')
                },
                { check: () => V.validatePhone(V.val(form, 'orgPhone'), 'Phone'), el: V.el(form, 'orgPhone') },
                {
                    check: () => {
                        const v = V.val(form, 'orgAddress');
                        let r = V.validateRequired(v, 'Address');
                        if (!r.valid) return r;
                        r = V.validateMinLength(v, 5, 'Address');
                        if (!r.valid) return r;
                        return V.validateMaxLength(v, 500, 'Address');
                    },
                    el: V.el(form, 'orgAddress')
                }
            ]);
            if(!ok) return;
            
            const btn = document.getElementById('save-profile-btn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
                await window.tsUsers.updateOrganizerProfile(uid, {
                    organizationName: V.val(form, 'orgName'),
                    organizationDescription: V.val(form, 'orgDesc'),
                    organizationPhone: V.val(form, 'orgPhone'),
                    organizationAddress: V.val(form, 'orgAddress')
                });
                btn.textContent = 'Saved!';
                setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Changes'; }, 2000);
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                btn.textContent = 'Save Changes';
            }
        });
    } catch(e) { console.error('Failed to load profile', e); }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Organization Profile', 'profile', $content, '..', '');
?>
