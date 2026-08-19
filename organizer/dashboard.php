<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Good afternoon, Nova Stage', 'Here is the current performance and action queue across your TickSecure events.', '<a class="ts-btn ts-btn-primary" href="event-new.php">'.ts_icon('plus').' Create Event</a>')?>
<div class="ts-kpi-grid">
    <?=ts_kpi('Active Events', '4', 'calendar', '+1 this month')?><?=ts_kpi('Tickets Sold', '3,842', 'ticket', '+12.4% vs last period')?><?=ts_kpi('Revenue', 'RM 1.84M', 'chart', '+9.2% vs last period')?><?=ts_kpi('Pending NFT Tx', '18', 'activity', 'Review pending transactions')?>
</div>
<div class="ts-grid-2 mt-24">
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Ticket sales trend</div>
                <div class="ts-card-sub">Last 8 reporting periods</div>
            </div><select class="ts-select" style="width:150px;height:38px">
                <option>All events</option>
            </select>
        </div>
        <div class="ts-line-chart"><svg viewBox="0 0 600 180" preserveAspectRatio="none">
                <path d="M0 140 C70 120,100 128,150 95 S240 80,280 88 S360 45,410 60 S510 35,600 25" fill="none"
                    stroke="#344054" stroke-width="4" />
                <path d="M0 150 H600 M0 105 H600 M0 60 H600" stroke="#EEF0F2" stroke-width="1" />
            </svg></div>
    </div>
    <div class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Action required</div>
                <div class="ts-card-sub">Items that need organizer attention</div>
            </div>
        </div>
        <div class="ts-card-pad">
            <div class="ts-list">
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Event correction requested</div>
                        <div class="ts-list-sub">Nocturne City · venue details</div>
                    </div>
                    <?=ts_status('Action', 'warning')?>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">3 failed NFT mints</div>
                        <div class="ts-list-sub">Aurora After Dark</div>
                    </div>
                    <?=ts_status('Review', 'error')?>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Suspicious resale reported</div>
                        <div class="ts-list-sub">Velvet Hour Live · ticket TS-884</div>
                    </div>
                    <?=ts_status('Flagged', 'warning')?>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Upcoming events</div>
            <div class="ts-card-sub">Status and sales snapshot</div>
        </div><a href="events.php" class="small">View all</a>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th>Sold</th>
                    <th>Revenue</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Aurora After Dark</td>
                    <td>18 Oct 2026</td>
                    <td>Merdeka Hall</td>
                    <td><?=ts_status('Published', 'success')?>
                    </td>
                    <td>1,244 / 1,600</td>
                    <td>RM 714K</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php">Manage</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Velvet Hour Live</td>
                    <td>02 Nov 2026</td>
                    <td>Axiata Arena</td>
                    <td><?=ts_status('Approved', 'info')?>
                    </td>
                    <td>988 / 1,500</td>
                    <td>RM 442K</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php">Manage</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Nocturne City</td>
                    <td>12 Dec 2026</td>
                    <td>Merdeka Hall</td>
                    <td><?=ts_status('Rejected', 'error')?>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php">Review</a></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer','Dashboard','dashboard',$content,'..','');
?>