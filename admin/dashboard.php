<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Administrator Dashboard', 'Platform-wide operations, governance, ticket security and risk monitoring.', '<a class="ts-btn ts-btn-secondary" href="reports.php">'.ts_icon('file').' Reports</a>')?>
<div class="ts-kpi-grid">
    <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Registered Users</span><span class="ts-kpi-icon"><?=ts_icon('users')?></span></div><div class="ts-kpi-value" id="kpi-users">...</div><div class="ts-kpi-label">Current platform view</div></div>
    <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Approved Organizers</span><span class="ts-kpi-icon"><?=ts_icon('building')?></span></div><div class="ts-kpi-value" id="kpi-organizers">...</div><div class="ts-kpi-label">Current platform view</div></div>
    <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Published Events</span><span class="ts-kpi-icon"><?=ts_icon('calendar')?></span></div><div class="ts-kpi-value" id="kpi-events">...</div><div class="ts-kpi-label">Current platform view</div></div>
    <div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>Blockchain Tx</span><span class="ts-kpi-icon"><?=ts_icon('ticket')?></span></div><div class="ts-kpi-value" id="kpi-txs">...</div><div class="ts-kpi-label">Current platform view</div></div>
</div>
<div class="ts-grid-4 mt-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Pending Organizers</span><span
                class="ts-kpi-icon"><?=ts_icon('building')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-pending-orgs">...</div>
        <div class="ts-kpi-label">Require review</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Event Reviews</span><span
                class="ts-kpi-icon"><?=ts_icon('calendar')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-pending-events">...</div>
        <div class="ts-kpi-label">Pending approval</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Risk Flags</span><span
                class="ts-kpi-icon"><?=ts_icon('flag')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-risk-flags">...</div>
        <div class="ts-kpi-label">Resale / transaction alerts</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Open Complaints</span><span
                class="ts-kpi-icon"><?=ts_icon('message')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-complaints">...</div>
        <div class="ts-kpi-label">Across all priorities</div>
    </div>
</div>
<div class="ts-grid-2 mt-24">
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">System activity trend</div>
                <div class="ts-card-sub">Important audited operations</div>
            </div>
        </div>
        <div class="ts-line-chart"><svg viewBox="0 0 600 180" preserveAspectRatio="none">
                <path d="M0 130 C60 90,105 115,150 78 S250 94,300 70 S390 45,450 58 S540 30,600 38" fill="none"
                    stroke="#344054" stroke-width="4" />
                <path d="M0 150 H600 M0 105 H600 M0 60 H600" stroke="#EEF0F2" stroke-width="1" />
            </svg></div>
    </div>
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Attention queue</div>
                <div class="ts-card-sub">Highest-priority reviews</div>
            </div>
        </div>
        <div class="ts-card-pad">
            <div class="ts-list">
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Review organizer applications</div>
                        <div class="ts-list-sub">Check pending queue</div>
                    </div><a href="organizers.php" class="ts-btn ts-btn-secondary ts-btn-sm">Review</a>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Review event submissions</div>
                        <div class="ts-list-sub">Check pending queue</div>
                    </div><a href="events.php" class="ts-btn ts-btn-secondary ts-btn-sm">Review</a>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Blockchain transactions</div>
                        <div class="ts-list-sub">Inspect alerts</div>
                    </div><a href="blockchain.php" class="ts-btn ts-btn-secondary ts-btn-sm">Inspect</a>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Recent audited activity</div>
            <div class="ts-card-sub">Read-only system actions</div>
        </div><a class="small" href="audit.php">Open Audit Log</a>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Date / Time</th>
                    <th>Actor</th>
                    <th>Role</th>
                    <th>Activity</th>
                    <th>Related Entity</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody id="audit-table-body">
                <tr><td colspan="6" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const [users, events, complaints, txs, logs] = await Promise.all([
            window.tsUsers.getUsers(),
            window.tsEvents.getEvents(),
            window.tsComplaints.getComplaints(),
            window.tsBlockchain.getTransactions(),
            window.tsAudit.getLogs()
        ]);
        
        document.getElementById('kpi-users').textContent = users.length;
        document.getElementById('kpi-organizers').textContent = users.filter(u => u.role === 'organizer' && u.status === 'approved').length;
        document.getElementById('kpi-pending-orgs').textContent = users.filter(u => u.role === 'organizer' && u.status === 'pending').length;
        
        document.getElementById('kpi-events').textContent = events.filter(e => e.status === 'published').length;
        document.getElementById('kpi-pending-events').textContent = events.filter(e => e.status === 'pending').length;
        
        document.getElementById('kpi-complaints').textContent = complaints.filter(c => c.status === 'open').length;
        document.getElementById('kpi-txs').textContent = txs.length;
        document.getElementById('kpi-risk-flags').textContent = txs.filter(t => t.status === 'failed').length;

        const tbody = document.getElementById('audit-table-body');
        if (!tbody) return;
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center secondary" style="padding:40px">No items found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = logs.slice(0, 5).map(log => {
            const date = new Date(log.createdAt).toLocaleString();
            let tone = log.result === 'success' ? 'success' : 'error';
            return `
                <tr>
                    <td>${esc(date)}</td>
                    <td>${esc(log.actorName)}</td>
                    <td>${esc(log.actorRole)}</td>
                    <td>${esc(log.action)}</td>
                    <td>${esc(log.targetId)}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(log.result)}</span></td>
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
render_dashboard_page('admin','Dashboard','dashboard',$content,'..','');
?>