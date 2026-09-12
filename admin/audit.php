<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Audit Log', 'Administrator-only, read-only history of sensitive and security-relevant actions across TickSecure.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export Audit</button>')?>
<div class="ts-alert ts-alert-info mb-24">
    <?=ts_icon('shield')?>
    <div><strong>Read-only governance record</strong>
        <div class="small mt-8">Audit entries cannot be edited by ordinary users. Filters only change the visible view.
        </div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="User, activity or related entity"></div><select class="ts-select">
            <option>All roles</option>
            <option>Administrator</option>
            <option>Organizer</option>
            <option>Buyer</option>
            <option>System</option>
        </select><select class="ts-select">
            <option>All activities</option>
            <option>Login</option>
            <option>Event</option>
            <option>NFT</option>
            <option>Resale</option>
            <option>Complaint</option>
        </select><input class="ts-input" type="date">
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Date / Time</th>
                    <th>User / System Actor</th>
                    <th>Role</th>
                    <th>Activity Type</th>
                    <th>Related Entity</th>
                    <th>Result</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody id="audit-table-body">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const logs = await window.tsAudit.getLogs();
        const tbody = document.getElementById('audit-table-body');
        if (!tbody) return;
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No audit logs found.</td></tr>';
            return;
        }
        
        const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
        
        tbody.innerHTML = logs.map((l, index) => {
            let tone = l.result === 'success' ? 'success' : 'error';
            return `
                <tr>
                    <td>${l.timestamp ? esc(new Date(l.timestamp).toLocaleString()) : '—'}</td>
                    <td>${esc(l.actorEmail || l.actorUid || 'System')}</td>
                    <td>${esc(l.actorRole)}</td>
                    <td>${esc(l.action)}</td>
                    <td>${esc(l.entityId || '—')}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(l.result)}</span></td>
                    <td><button class="ts-btn ts-btn-tertiary ts-btn-sm audit-details" type="button" data-index="${index}">View</button></td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.audit-details').forEach(button => {
            button.addEventListener('click', () => {
                const log = logs[Number(button.dataset.index)];
                window.alert(`Raw Data:\n${JSON.stringify(log?.details || {}, null, 2)}`);
            });
        });
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Audit Logs', 'audit', $content, '..', '');
?>
