<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-org-application">
    <a class="ts-org-back" href="organizers.php">← Back to applications</a>
    <?=ts_page_head('Loading...', ' ', '<div id="action-buttons" class="ts-org-actions" style="display:none;"><button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button><button id="btn-approve" class="ts-btn ts-btn-success">Approve Organizer</button></div>')?>
    <div id="org-detail-container" style="display:none;">
        <section class="ts-card ts-org-summary" aria-label="Application details">
            <dl>
                <div><dt>Application status</dt><dd id="val-application-status"></dd></div>
                <div><dt>Submitted</dt><dd id="val-submitted"></dd></div>
                <div><dt>Last updated</dt><dd id="val-updated"></dd></div>
            </dl>
            <p>All dates and times use Malaysia time (UTC+8).</p>
        </section>
        <div class="ts-grid-2 ts-org-profiles">
            <section class="ts-card ts-card-pad">
                <div class="ts-org-card-heading"><?=ts_icon('user')?><h2 class="ts-card-title">Applicant Identity</h2></div>
                <dl class="ts-org-fields">
                    <div class="ts-detail-item"><dt class="ts-detail-label">Full name</dt><dd class="ts-detail-value" id="val-name"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Email address</dt><dd class="ts-detail-value" id="val-email"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Email verification</dt><dd class="ts-detail-value" id="val-verified"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Account ID</dt><dd class="ts-detail-value ts-org-code" id="val-account-id"></dd></div>
                </dl>
            </section>
            <section class="ts-card ts-card-pad">
                <div class="ts-org-card-heading"><?=ts_icon('building')?><h2 class="ts-card-title">Organization Profile</h2></div>
                <dl class="ts-org-fields">
                    <div class="ts-detail-item"><dt class="ts-detail-label">Organization name</dt><dd class="ts-detail-value" id="val-org-name"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Contact phone</dt><dd class="ts-detail-value" id="val-phone"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Business address</dt><dd class="ts-detail-value" id="val-address"></dd></div>
                    <div class="ts-detail-item"><dt class="ts-detail-label">Connected wallet</dt><dd class="ts-detail-value ts-org-code" id="val-wallet"></dd></div>
                </dl>
            </section>
        </div>
        <section class="ts-card ts-card-pad mt-24">
            <h2 class="ts-card-title">About the organization</h2>
            <p class="secondary ts-org-description" id="val-desc"></p>
        </section>
        <section class="ts-card ts-card-pad mt-24" id="org-review-note" hidden>
            <h2 class="ts-card-title">Review reason</h2>
            <p class="secondary ts-org-description" id="val-review-reason"></p>
        </section>
        
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
        document.querySelector('.ts-page-title').textContent = 'Organizer not found';
        return;
    }

    const formatDate = value => {
        if (!value) return 'Not recorded';
        const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        return Number.isNaN(date.valueOf()) ? 'Not recorded' : date.toLocaleString('en-MY', {
            timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        });
    };
    const loadOrg = async () => {
        try {
            const user = await window.tsUsers.getUser(userId);
            if (!user) throw new Error('User not found');
            const org = await window.tsUsers.getOrganizerProfile(userId) || {};
            
            document.getElementById('org-detail-container').style.display = 'block';
            document.querySelector('.ts-page-title').textContent = user.organizationName || org.organizationName || 'No Name';
            document.querySelector('.ts-page-subtitle').textContent = `Review the organizer application from ${user.fullName || 'this applicant'}.`;
            document.getElementById('val-submitted').textContent = formatDate(user.submittedAt || user.createdAt);
            document.getElementById('val-updated').textContent = formatDate(user.updatedAt || org.updatedAt);
            document.getElementById('val-account-id').textContent = userId;
            document.getElementById('val-wallet').textContent = user.walletAddress || 'Not connected';
            const statuses = { pending: ['Pending review', 'warning'], active: ['Active', 'success'], rejected: ['Rejected', 'error'], inactive: ['Inactive', 'neutral'], suspended: ['Suspended', 'error'], deleted: ['Deleted', 'error'] };
            const [statusLabel, statusTone] = statuses[user.status] || ['Unknown', 'neutral'];
            document.getElementById('val-application-status').innerHTML = `<span class="ts-chip ts-chip-${statusTone}">${statusLabel}</span>`;
            document.getElementById('org-review-note').hidden = !user.rejectReason;
            document.getElementById('val-review-reason').textContent = user.rejectReason || '';
            
            document.getElementById('val-name').textContent = user.fullName || 'N/A';
            document.getElementById('val-email').textContent = user.email || 'Not provided';
            document.getElementById('val-verified').innerHTML = user.emailVerified ? `<span class="ts-chip ts-chip-success">Verified</span>` : `<span class="ts-chip ts-chip-neutral">Unverified</span>`;
            
            document.getElementById('val-org-name').textContent = user.organizationName || org.organizationName || 'N/A';
            document.getElementById('val-phone').textContent = user.phone || org.organizationPhone || 'N/A';
            document.getElementById('val-address').textContent = user.address || org.organizationAddress || 'N/A';
            document.getElementById('val-desc').textContent = user.description || org.organizationDescription || 'No description provided.';
            
            if (user.status === 'pending') {
                document.getElementById('action-buttons').style.display = 'flex';
            } else {
                document.getElementById('action-buttons').style.display = 'none';
            }
            
            let saving = false;
            const decide = async action => {
                if (saving) return;
                saving = true;
                const buttons = ['btn-approve', 'btn-reject'].map(id => document.getElementById(id));
                try {
                    const decision = await window.tsAdminConfirm(action + 'Organizer', user.organizationName || org.organizationName || user.fullName || 'Organizer application', [['Applicant', user.fullName], ['Email', user.email]]);
                    if (!decision) return;
                    buttons.forEach(button => { button.disabled = true; });
                    if (action === 'approve') await window.tsUsers.approveOrganizer(userId);
                    else await window.tsUsers.rejectOrganizer(userId, decision.reason);
                    await loadOrg();
                } catch (error) {
                    alert(error.message || 'The organizer application could not be updated.');
                } finally {
                    saving = false;
                    buttons.forEach(button => { button.disabled = false; });
                }
            };
            document.getElementById('btn-approve').onclick = () => decide('approve');
            document.getElementById('btn-reject').onclick = () => decide('reject');

        } catch (err) {
            console.error(err);
            document.querySelector('.ts-page-title').textContent = 'Error loading organizer';
        }
    };
    
    await loadOrg();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Organizer Application', 'organizers', $content, '..', '');
?>