<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Organizer Applications', 'Review pending Event Organizer registrations and record approval or rejection decisions.', '')?>
<div class="ts-kpi-grid mb-24">
    <?=ts_kpi('Pending', '<span id="pending-organizers-kpi">...</span>', 'clock')?><?=ts_kpi('Active organizers', '<span id="active-organizers-kpi">...</span>', 'check')?><?=ts_kpi('Rejected', '<span id="rejected-organizers-kpi">...</span>', 'x')?><?=ts_kpi('Total organizers', '<span id="total-organizers-kpi">...</span>', 'activity')?>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Applicant or organization"></div><select class="ts-select">
            <option>Pending first</option>
            <option>Newest first</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Applicant</th>
                    <th>Organization</th>
                    <th>Email</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="orgs-table-body">
                <tr><td colspan="6" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const users = await window.tsUsers.getUsers();
        const organizers = users.filter(u => u.role === 'organizer');
        const tbody = document.getElementById('orgs-table-body');
        if (!tbody) return;
        document.getElementById('pending-organizers-kpi').textContent = organizers.filter(o => o.status === 'pending').length;
        document.getElementById('active-organizers-kpi').textContent = organizers.filter(o => o.status === 'active').length;
        document.getElementById('rejected-organizers-kpi').textContent = organizers.filter(o => o.status === 'rejected').length;
        document.getElementById('total-organizers-kpi').textContent = organizers.length;
        
        if (organizers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center secondary" style="padding:40px">No organizer applications found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = organizers.map(o => {
            let tone = 'neutral';
            if (o.status === 'pending') tone = 'warning';
            else if (o.status === 'active') tone = 'success';
            else if (o.status === 'rejected') tone = 'error';

            return `
                <tr>
                    <td class="cell-title">${esc(o.fullName)}</td>
                    <td>${esc(o.organizationName || 'N/A')}</td>
                    <td>${esc(o.email)}</td>
                    <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(o.status || 'pending')}</span></td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="organizer-detail.php?id=${o.id}">Review</a></td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Organizer Applications', 'organizers', $content, '..', '');
?>
