<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="ts-admin-dashboard">
    <header class="ts-admin-dashboard-hero">
        <div>
            <span class="ts-admin-dashboard-kicker">ADMINISTRATION</span>
            <h1>Administrator dashboard</h1>
            <p>Manage your platform, review applications and keep track of what needs attention.</p>
        </div>
        <div class="ts-admin-dashboard-hero-side">
            <div class="ts-admin-dashboard-actions">
                <a class="ts-btn ts-btn-secondary" href="events.php"><?=ts_icon('calendar')?> Manage events</a>
                <a class="ts-btn ts-btn-primary" href="reports.php"><?=ts_icon('chart')?> Sales report</a>
            </div>
            <p id="admin-dashboard-status" role="status" aria-live="polite">Loading platform data…</p>
        </div>
    </header>

    <div class="ts-kpi-grid ts-admin-dashboard-metrics">
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Registered accounts</span><span class="ts-kpi-icon"><?=ts_icon('users')?></span></div><div class="ts-kpi-value" id="kpi-users">…</div><div class="ts-kpi-label">Across all account roles</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Active organizers</span><span class="ts-kpi-icon"><?=ts_icon('building')?></span></div><div class="ts-kpi-value" id="kpi-organizers">…</div><div class="ts-kpi-label">Approved organizer accounts</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Published events</span><span class="ts-kpi-icon"><?=ts_icon('calendar')?></span></div><div class="ts-kpi-value" id="kpi-events">…</div><div class="ts-kpi-label">Currently published on TickSecure</div></div>
        <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>NFT transactions</span><span class="ts-kpi-icon"><?=ts_icon('ticket')?></span></div><div class="ts-kpi-value" id="kpi-txs">…</div><div class="ts-kpi-label">Recorded across the platform</div></div>
    </div>

    <div class="ts-admin-dashboard-grid">
        <section class="ts-card ts-card-pad">
            <div class="ts-admin-dashboard-section-head"><div><h2>Quick access</h2><p>Your everyday administration tools.</p></div><?=ts_icon('layout')?></div>
            <div class="ts-admin-shortcuts">
                <a href="users.php" class="ts-admin-shortcut"><span class="ts-admin-shortcut-icon"><?=ts_icon('users')?></span><div><strong>Users</strong><span>Manage buyer accounts</span></div><?=ts_icon('arrow-right')?></a>
                <a href="organizer-list.php" class="ts-admin-shortcut"><span class="ts-admin-shortcut-icon"><?=ts_icon('building')?></span><div><strong>Organizers</strong><span>View active organizers</span></div><?=ts_icon('arrow-right')?></a>
                <a href="venues.php" class="ts-admin-shortcut"><span class="ts-admin-shortcut-icon"><?=ts_icon('layout')?></span><div><strong>Venues & layouts</strong><span>Manage event spaces</span></div><?=ts_icon('arrow-right')?></a>
                <a href="reports.php" class="ts-admin-shortcut"><span class="ts-admin-shortcut-icon"><?=ts_icon('chart')?></span><div><strong>Sales reports</strong><span>Monthly and yearly sales</span></div><?=ts_icon('arrow-right')?></a>
            </div>
        </section>
        <section class="ts-card ts-card-pad">
            <div class="ts-admin-dashboard-section-head"><div><h2>Review queue</h2><p>Applications and events awaiting your decision.</p></div><?=ts_icon('clock')?></div>
            <div class="ts-admin-review-list">
                <a href="organizers.php" class="ts-admin-review-item"><div><strong>Organizer applications</strong><span>Review pending registrations</span></div><span class="ts-admin-review-count" id="kpi-pending-orgs">…</span><?=ts_icon('arrow-right')?></a>
                <a href="events.php" class="ts-admin-review-item"><div><strong>Event submissions</strong><span>Review events awaiting approval</span></div><span class="ts-admin-review-count" id="kpi-pending-events">…</span><?=ts_icon('arrow-right')?></a>
            </div>
            <div class="ts-admin-support-stats">
                <div><span>Failed NFT transactions</span><strong id="kpi-risk-flags">…</strong></div>
                <div><span>Open complaints</span><strong id="kpi-complaints">…</strong></div>
            </div>
        </section>
    </div>

    <section class="ts-card ts-admin-dashboard-activity">
        <div class="ts-card-head">
            <div class="ts-admin-dashboard-section-head"><div><h2>Recent activity</h2><p>The latest five recorded actions across the platform.</p></div></div>
            <a class="ts-btn ts-btn-secondary ts-btn-sm" href="audit.php">View activity log <?=ts_icon('arrow-right')?></a>
        </div>
        <div class="ts-table-wrap">
            <table class="ts-table">
                <thead><tr><th>Date / time</th><th>Account</th><th>Role</th><th>Activity</th><th>Related record</th><th>Result</th></tr></thead>
                <tbody id="audit-table-body"><tr><td colspan="6" class="text-center secondary" style="padding:32px">Loading recent activity…</td></tr></tbody>
            </table>
        </div>
    </section>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const [users, events, complaints, txs, logs] = await Promise.all([
            window.tsUsers.getUsers(),
            window.tsEvents.getAdminEvents(),
            window.tsComplaints.getComplaints(),
            window.tsBlockchain.getTransactions(),
            window.tsAudit.getLogs()
        ]);
        
        document.getElementById('kpi-users').textContent = users.length;
        document.getElementById('kpi-organizers').textContent = users.filter(u => u.role === 'organizer' && u.status === 'active').length;
        document.getElementById('kpi-pending-orgs').textContent = users.filter(u => u.role === 'organizer' && u.status === 'pending').length;
        
        document.getElementById('kpi-events').textContent = events.filter(e => e.status === 'PUBLISHED').length;
        document.getElementById('kpi-pending-events').textContent = events.filter(e => e.status === 'PENDING_REVIEW').length;
        
        document.getElementById('kpi-complaints').textContent = complaints.filter(c => c.status === 'OPEN').length;
        document.getElementById('kpi-txs').textContent = txs.length;
        document.getElementById('kpi-risk-flags').textContent = txs.filter(t => t.status === 'FAILED').length;

        document.getElementById('admin-dashboard-status').textContent = 'Updated ' + new Date().toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }) + ' · Malaysia time';
        const tbody = document.getElementById('audit-table-body');
        if (!tbody) return;
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center secondary" style="padding:40px">No recent activity recorded yet.</td></tr>';
            return;
        }
        
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
        
        tbody.innerHTML = logs.slice(0, 5).map(log => {
            const recordedAt = typeof log.timestamp?.toDate === 'function' ? log.timestamp.toDate() : new Date(log.timestamp || '');
            const date = Number.isNaN(recordedAt.valueOf()) ? 'Not recorded' : recordedAt.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
            let tone = log.result === 'success' ? 'success' : 'error';
            return `
                <tr>
                    <td>${esc(date)}</td>
                    <td>${esc(log.actorEmail || log.actorUid || 'System')}</td>
                    <td>${esc(log.actorRole)}</td>
                    <td>${esc(log.action)}</td>
                    <td>${esc(log.entityId || '—')}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(log.result)}</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Load error:', err);
        document.getElementById('admin-dashboard-status').textContent = 'Could not load platform data. Refresh to try again.';
        ['kpi-users', 'kpi-organizers', 'kpi-events', 'kpi-txs', 'kpi-pending-orgs', 'kpi-pending-events', 'kpi-risk-flags', 'kpi-complaints'].forEach(id => { document.getElementById(id).textContent = '—'; });
        document.getElementById('audit-table-body').innerHTML = '<tr><td colspan="6" class="text-center secondary" style="padding:32px">Recent activity could not be loaded. Please refresh.</td></tr>';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin','Dashboard','dashboard',$content,'..','');
?>
