<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Organization Profile', 'Manage organization-specific information while shared account identity remains inherited from your TickSecure user account.', '<button class="ts-btn ts-btn-primary" id="save-profile-btn">Save Changes</button>')?>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Shared User Identity</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Full Name</label><input class="ts-input" id="sharedName" disabled>
            </div>
            <div class="ts-field"><label class="ts-label">Email</label><input class="ts-input" id="sharedEmail" disabled></div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="flex justify-between items-center">
            <div class="ts-card-title">Approval Status</div>
            <div id="org-status-chip"></div>
        </div>
        <p class="secondary mt-16">Your organization is approved to create and submit events. Approval status is managed
            by the Administrator.</p>
        <div class="ts-detail-item">
            <div class="ts-detail-label">Approved Date</div>
            <div class="ts-detail-value" id="org-approved-date">-</div>
        </div>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24" id="org-profile-form">
    <div class="ts-card-title">Organization Information</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field"><label class="ts-label">Organization Name</label><input class="ts-input"
                id="orgName" name="orgName"></div>
        <div class="ts-field"><label class="ts-label">Organization Phone</label><input class="ts-input"
                id="orgPhone" name="orgPhone"></div>
        <div class="ts-field span-2"><label class="ts-label">Organization Description</label><textarea
                class="ts-textarea" id="orgDesc" name="orgDesc"></textarea>
        </div>
        <div class="ts-field span-2"><label class="ts-label">Organization Address</label><input class="ts-input"
                id="orgAddress" name="orgAddress"></div>
    </div>
</div>

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
