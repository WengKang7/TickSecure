<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('User Management', 'Search registered Buyers and Event Organizers, review account status and apply access controls.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Search name or email"></div><select class="ts-select">
            <option>All roles</option>
            <option>Buyer</option>
            <option>Event Organizer</option>
        </select><select class="ts-select">
            <option>All statuses</option>
            <option>Active</option>
            <option>Suspended</option>
        </select><select class="ts-select">
            <option>All verification</option>
            <option>Verified</option>
            <option>Unverified</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    <th>Email Verified</th>
                    <th>Created</th>
                    <th>Last Activity</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="users-table-body">
                <tr><td colspan="8" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
    <div class="ts-pagination"><span>Showing users</span>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const loadUsers = async () => {
        try {
            const users = await window.tsUsers.getUsers();
            const tbody = document.getElementById('users-table-body');
            if (!tbody) return;
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center secondary" style="padding:40px">No users found.</td></tr>';
                return;
            }
            
            const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
            
            tbody.innerHTML = users.map(u => {
                let statusTone = u.status === 'active' ? 'success' : (u.status === 'suspended' ? 'error' : 'neutral');
                let verifiedTone = u.emailVerified ? 'success' : 'neutral';
                let verifiedText = u.emailVerified ? 'Verified' : 'Unverified';
                let roleChipTone = u.role === 'admin' ? 'purple' : (u.role === 'organizer' ? 'warning' : 'neutral');
                
                let toggleBtn = '';
                if (u.status === 'suspended') {
                    toggleBtn = `<button class="ts-btn ts-btn-secondary ts-btn-sm text-success action-reactivate" data-id="${u.id}">Reactivate</button>`;
                } else if (u.status === 'active' && u.role !== 'admin') {
                    toggleBtn = `<button class="ts-btn ts-btn-secondary ts-btn-sm text-error action-suspend" data-id="${u.id}">Suspend</button>`;
                }

                return `
                    <tr>
                        <td class="cell-title">${esc(u.fullName || 'No Name')}</td>
                        <td>${esc(u.email)}</td>
                        <td><span class="ts-chip ts-chip-${roleChipTone}">${esc(u.role)}</span></td>
                        <td><span class="ts-chip ts-chip-${statusTone}">${esc(u.status || 'active')}</span></td>
                        <td><span class="ts-chip ts-chip-${verifiedTone}">${verifiedText}</span></td>
                        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>${u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString() : 'N/A'}</td>
                        <td class="flex gap-4">
                            <a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php?id=${u.id}">View</a>
                            ${toggleBtn}
                        </td>
                    </tr>
                `;
            }).join('');
            
            document.querySelectorAll('.action-suspend').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const reason = prompt('Reason for suspension:');
                    if (reason) {
                        try {
                            btn.disabled = true;
                            await window.tsUsers.suspendUser(btn.dataset.id, reason);
                            await loadUsers();
                        } catch(err) { alert(err.message); }
                    }
                });
            });
            
            document.querySelectorAll('.action-reactivate').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Reactivate this user?')) {
                        try {
                            btn.disabled = true;
                            await window.tsUsers.reactivateUser(btn.dataset.id);
                            await loadUsers();
                        } catch(err) { alert(err.message); }
                    }
                });
            });
            
        } catch (err) {
            console.error('Load error:', err);
        }
    };
    
    await loadUsers();
});
</script>
    <div class="ts-pagination"><span>Showing 1–3 of 12,482 users</span>
        <div class="ts-page-numbers"><span class="ts-page-num active">1</span><span class="ts-page-num">2</span><span
                class="ts-page-num">3</span></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'User Management', 'users', $content, '..', '');
?>