<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Event Oversight', 'Review event submissions, monitor approved events and manage suspension/cancellation when required.', '')?>
<div class="ts-tabs mb-24"><button class="ts-tab active">Pending Review</button><button class="ts-tab">All
        Events</button><button class="ts-tab">Suspended</button><button class="ts-tab">Cancelled</button><button
        class="ts-tab">Review History</button></div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Event, organizer or venue"></div><select class="ts-select">
            <option>Pending first</option>
            <option>Newest submission</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Organizer</th>
                    <th>Venue</th>
                    <th>Event Date</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">Nocturne City</td>
                    <td>Nova Stage Entertainment</td>
                    <td>Merdeka Hall</td>
                    <td>12 Dec 2026</td>
                    <td>18 Aug · 11:20</td>
                    <td><?=ts_status('Pending Review', 'warning')?>
                    </td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="event-review.php">Review</a></td>
                </tr>
                <tr>
                    <td class="cell-title">Arc & Echo</td>
                    <td>Northline Live</td>
                    <td>Axiata Arena</td>
                    <td>20 Dec 2026</td>
                    <td>17 Aug · 17:08</td>
                    <td><?=ts_status('Pending Review', 'warning')?>
                    </td>
                    <td><a class="ts-btn ts-btn-primary ts-btn-sm" href="event-review.php">Review</a></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Event Oversight', 'events', $content, '..', '');
?>