<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Administrator Dashboard', 'Platform-wide operations, governance, ticket security and risk monitoring.', '<a class="ts-btn ts-btn-secondary" href="reports.php">'.ts_icon('file').' Reports</a>')?>
<div class="ts-kpi-grid">
    <?=ts_kpi('Registered Users', '12,482', 'users', '+342 this month')?><?=ts_kpi('Approved Organizers', '86', 'building', '+4 this month')?><?=ts_kpi('Published Events', '124', 'calendar', '+9 this month')?><?=ts_kpi('NFT Tickets Issued', '48,920', 'ticket', '99.4% confirmed')?>
</div>
<div class="ts-grid-4 mt-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Pending Organizers</span><span
                class="ts-kpi-icon"><?=ts_icon('building')?></span>
        </div>
        <div class="ts-kpi-value">7</div>
        <div class="ts-kpi-label">Require review</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Event Reviews</span><span
                class="ts-kpi-icon"><?=ts_icon('calendar')?></span>
        </div>
        <div class="ts-kpi-value">11</div>
        <div class="ts-kpi-label">Pending approval</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Risk Flags</span><span
                class="ts-kpi-icon"><?=ts_icon('flag')?></span>
        </div>
        <div class="ts-kpi-value">14</div>
        <div class="ts-kpi-label">Resale / transaction alerts</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Open Complaints</span><span
                class="ts-kpi-icon"><?=ts_icon('message')?></span>
        </div>
        <div class="ts-kpi-value">32</div>
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
                        <div class="ts-list-title">7 organizer applications</div>
                        <div class="ts-list-sub">Oldest waiting 18 hours</div>
                    </div><a href="organizers.php" class="ts-btn ts-btn-secondary ts-btn-sm">Review</a>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">11 event submissions</div>
                        <div class="ts-list-sub">Includes 2 correction resubmissions</div>
                    </div><a href="events.php" class="ts-btn ts-btn-secondary ts-btn-sm">Review</a>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">5 failed blockchain transactions</div>
                        <div class="ts-list-sub">Mint / transfer failures</div>
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
            <tbody>
                <tr>
                    <td>18 Aug · 14:12</td>
                    <td>Admin Account</td>
                    <td>Administrator</td>
                    <td>Organizer Approved</td>
                    <td>ORG-0086</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td>18 Aug · 13:58</td>
                    <td>Nova Stage</td>
                    <td>Organizer</td>
                    <td>Event Submitted</td>
                    <td>EVT-0144</td>
                    <td><?=ts_status('Success', 'success')?>
                    </td>
                </tr>
                <tr>
                    <td>18 Aug · 13:41</td>
                    <td>System</td>
                    <td>System</td>
                    <td>NFT Mint</td>
                    <td>TS-TK-100186</td>
                    <td><?=ts_status('Failed', 'error')?>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin','Dashboard','dashboard',$content,'..','');
?>