<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<button id="btn-toggle-status" class="ts-btn ts-btn-danger" style="display:none;">Suspend Account</button>')?>
<div id="user-detail-container" style="display:none;">
    <div class="ts-grid-2">
        <div class="ts-card ts-card-pad">
            <div class="flex justify-between">
                <div class="ts-card-title">Account Information</div>
                <div id="user-status-chip"></div>
            </div>
            <div class="ts-detail-grid mt-12">
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Full Name</div>
                    <div class="ts-detail-value" id="val-name"></div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Role</div>
                    <div class="ts-detail-value" id="val-role"></div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Email</div>
                    <div class="ts-detail-value" id="val-email"></div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Email Verified</div>
                    <div class="ts-detail-value" id="val-verified"></div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Created</div>
                    <div class="ts-detail-value" id="val-created"></div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Failed Login Attempts</div>
                    <div class="ts-detail-value">0</div>
                </div>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Wallet & Ticket Summary</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Connected Wallet</div>
                <div class="ts-detail-value ts-wallet-id" id="val-wallet">Not connected</div>
            </div>
            <div class="ts-summary-row"><span>Current NFT Tickets</span><strong id="val-tickets">0</strong></div>
            <div class="ts-summary-row"><span>Bookings</span><strong id="val-bookings">0</strong></div>
            <div class="ts-summary-row"><span>Resale Transactions</span><strong id="val-resale">0</strong></div>
        </div>
    </div>
    <div class="ts-card mt-24">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Recent Activity</div>
                <div class="ts-card-sub">User-specific audited activity</div>
            </div>
        </div>
        <div class="ts-table-wrap">
            <table class="ts-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Activity</th>
                        <th>Related Entity</th>
                        <th>Result</th>
                    </tr>
                </thead>
                <tbody id="activity-table-body">
                    <tr><td colspan="4" class="text-center secondary">No recent activity</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
        document.querySelector('.ts-page-title').textContent = 'User not found';
        return;
    }

    const loadUser = async () => {
        try {
            const user = await window.tsUsers.getUser(userId);
            if (!user) throw new Error('User not found');
            
            document.getElementById('user-detail-container').style.display = 'block';
            document.querySelector('.ts-page-title').textContent = user.fullName || 'No Name';
            document.querySelector('.ts-page-subtitle').textContent = `${user.role} account · ${user.email}`;
            
            let statusTone = user.status === 'active' ? 'success' : (user.status === 'suspended' ? 'error' : 'warning');
            document.getElementById('user-status-chip').innerHTML = `<span class="ts-chip ts-chip-${statusTone}">${user.status || 'active'}</span>`;
            
            document.getElementById('val-name').textContent = user.fullName || 'N/A';
            document.getElementById('val-role').textContent = user.role;
            document.getElementById('val-email').textContent = user.email;
            document.getElementById('val-verified').textContent = user.emailVerified ? 'Yes' : 'No';
            document.getElementById('val-created').textContent = new Date(user.createdAt).toLocaleDateString();
            
            if (user.walletAddress) document.getElementById('val-wallet').textContent = user.walletAddress;

            const btn = document.getElementById('btn-toggle-status');
            btn.style.display = 'inline-flex';
            if (user.status === 'suspended') {
                btn.textContent = 'Reactivate Account';
                btn.className = 'ts-btn ts-btn-success';
                btn.onclick = async () => {
                    if (confirm('Reactivate this user?')) {
                        await window.tsUsers.reactivateUser(userId);
                        await loadUser();
                    }
                };
            } else {
                btn.textContent = 'Suspend Account';
                btn.className = 'ts-btn ts-btn-danger';
                btn.onclick = async () => {
                    const reason = prompt('Reason for suspension:');
                    if (reason) {
                        await window.tsUsers.suspendUser(userId, reason);
                        await loadUser();
                    }
                };
            }
        } catch (err) {
            console.error(err);
            document.querySelector('.ts-page-title').textContent = 'Error loading user';
        }
    };
    
    await loadUser();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'User Details', 'users', $content, '..', '');
?>