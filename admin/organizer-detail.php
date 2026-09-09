<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<div id="action-buttons" style="display:none;"><button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button> <button id="btn-approve" class="ts-btn ts-btn-success">Approve Organizer</button></div>')?>
<div id="org-detail-container" style="display:none;">
    <div class="ts-grid-2">
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Applicant Identity</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Full Name</div>
                <div class="ts-detail-value" id="val-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Email</div>
                <div class="ts-detail-value" id="val-email"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Email Verification</div>
                <div class="ts-detail-value" id="val-verified">
                </div>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Organization Profile</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Organization Name</div>
                <div class="ts-detail-value" id="val-org-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Phone</div>
                <div class="ts-detail-value" id="val-phone"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Address</div>
                <div class="ts-detail-value" id="val-address"></div>
            </div>
        </div>
    </div>
    <div class="ts-card ts-card-pad mt-24">
        <div class="ts-card-title">Organization Description</div>
        <p class="secondary" id="val-desc"></p>
    </div>
    <div class="ts-alert ts-alert-info mt-24">
        <?=ts_icon('shield')?>
        <div><strong>Decision is audit-sensitive</strong>
            <div class="small mt-8">Approval or rejection will be recorded with Administrator identity, date/time and
                outcome. Rejection requires a reason.</div>
        </div>
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

    const loadOrg = async () => {
        try {
            const user = await window.tsUsers.getUser(userId);
            if (!user) throw new Error('User not found');
            const org = await window.tsUsers.getOrganizerProfile(userId) || {};
            
            document.getElementById('org-detail-container').style.display = 'block';
            document.querySelector('.ts-page-title').textContent = user.organizationName || org.organizationName || 'No Name';
            document.querySelector('.ts-page-subtitle').textContent = `Organizer application submitted by ${user.fullName} on ${new Date(user.createdAt).toLocaleDateString()}.`;
            
            document.getElementById('val-name').textContent = user.fullName || 'N/A';
            document.getElementById('val-email').textContent = user.email;
            document.getElementById('val-verified').innerHTML = user.emailVerified ? `<span class="ts-chip ts-chip-success">Verified</span>` : `<span class="ts-chip ts-chip-neutral">Unverified</span>`;
            
            document.getElementById('val-org-name').textContent = user.organizationName || org.organizationName || 'N/A';
            document.getElementById('val-phone').textContent = user.phone || org.organizationPhone || 'N/A';
            document.getElementById('val-address').textContent = user.address || org.organizationAddress || 'N/A';
            document.getElementById('val-desc').textContent = user.description || org.organizationDescription || 'No description provided.';
            
            if (user.status === 'pending') {
                document.getElementById('action-buttons').style.display = 'block';
            } else {
                document.getElementById('action-buttons').style.display = 'none';
            }
            
            document.getElementById('btn-approve').onclick = async () => {
                if (confirm('Approve this organizer?')) {
                    await window.tsUsers.approveOrganizer(userId);
                    await loadOrg();
                }
            };
            
            document.getElementById('btn-reject').onclick = async () => {
                const reason = prompt('Reason for rejection:');
                if (reason) {
                    await window.tsUsers.rejectOrganizer(userId, reason);
                    await loadOrg();
                }
            };

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