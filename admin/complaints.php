<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Complaint Management', 'Investigate complaints using related booking, payment, NFT ownership, wallet, resale and blockchain records.', '')?>
<div class="ts-tabs mb-24"><button class="ts-tab active">Open</button><button class="ts-tab">Under
        Investigation</button><button class="ts-tab">Awaiting Information</button><button
        class="ts-tab">Resolved</button><button class="ts-tab">Rejected</button></div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Reference, complainant or category"></div><select class="ts-select">
            <option>All priorities</option>
            <option>High</option>
            <option>Normal</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Complainant</th>
                    <th>Role</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="complaints-table-body">
                <tr><td colspan="8" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const complaints = await window.tsComplaints.getComplaints();
        const tbody = document.getElementById('complaints-table-body');
        if (!tbody) return;
        
        if (complaints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center secondary" style="padding:40px">No complaints found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = complaints.map(c => {
            let statusTone = 'neutral';
            if (c.status === 'open') statusTone = 'info';
            else if (c.status === 'investigating') statusTone = 'warning';
            else if (c.status === 'resolved') statusTone = 'success';
            else if (c.status === 'rejected') statusTone = 'error';

            let priorityTone = 'neutral';
            if (c.priority === 'high') priorityTone = 'error';
            else if (c.priority === 'normal') priorityTone = 'neutral';
            
            return `
                <tr>
                    <td class="cell-title">${esc(c.reference || c.id)}</td>
                    <td>${esc(c.complainantName || c.userId)}</td>
                    <td>${esc(c.role || 'Unknown')}</td>
                    <td>${esc(c.category)}</td>
                    <td><span class="ts-chip ts-chip-${priorityTone}">${esc(c.priority || 'normal')}</span></td>
                    <td><span class="ts-chip ts-chip-${statusTone}">${esc(c.status || 'open')}</span></td>
                    <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="complaint-detail.php?id=${c.id}">Investigate</a></td>
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
render_dashboard_page('admin', 'Complaint Management', 'complaints', $content, '..', '');
?>