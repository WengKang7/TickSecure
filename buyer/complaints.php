<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Support</div>
                <h1 class="ts-section-title">Complaints & Disputes</h1>
                <p class="ts-section-copy">Track ticket, payment, ownership, resale and account-related complaints.</p>
            </div><a class="ts-btn ts-btn-primary" href="complaint-new.php">New Complaint</a>
        </div>
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Category</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="complaints-tbody">
                        <tr><td colspan="6" class="text-center secondary" style="padding:40px">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const complaints = await window.tsComplaints.getUserComplaints();
        const tbody = document.getElementById('complaints-tbody');
        
        if (complaints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center secondary" style="padding:40px">No complaints found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = complaints.map(c => {
            let tone = 'warning';
            let status = 'Under Investigation';
            if (c.status === 'open') { tone = 'info'; status = 'Open'; }
            else if (c.status === 'resolved') { tone = 'success'; status = 'Resolved'; }
            else if (c.status === 'rejected') { tone = 'error'; status = 'Rejected'; }
            else if (c.status === 'investigating') { tone = 'warning'; status = 'Investigating'; }
            
            const submitStr = c.createdAt ? (typeof c.createdAt.toDate === 'function' ? c.createdAt.toDate().toLocaleDateString() : c.createdAt) : '-';
            const updateStr = c.updatedAt ? (typeof c.updatedAt.toDate === 'function' ? c.updatedAt.toDate().toLocaleDateString() : c.updatedAt) : submitStr;
            
            return \`
            <tr>
                <td class="cell-title">\${c.id}</td>
                <td>\${c.category || '-'}</td>
                <td>\${submitStr}</td>
                <td><span class="ts-chip ts-chip-\${tone}">\${status}</span></td>
                <td>\${updateStr}</td>
                <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="complaint-detail.php?id=\${c.id}">View</a></td>
            </tr>
            \`;
        }).join('');
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Complaints', 'tickets', $content, '..', true);
?>