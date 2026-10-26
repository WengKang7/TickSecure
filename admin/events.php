<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Event Oversight', 'Review event submissions, monitor approved events and manage suspension/cancellation when required.', '')?>
<nav class="ts-tabs mb-24" id="admin-event-filters" aria-label="Filter events by status">
    <button type="button" class="ts-tab active" data-event-filter="pending" aria-pressed="true">Pending Review</button>
    <button type="button" class="ts-tab" data-event-filter="all" aria-pressed="false">All Submitted Events</button>
    <button type="button" class="ts-tab" data-event-filter="suspended" aria-pressed="false">Suspended</button>
    <button type="button" class="ts-tab" data-event-filter="cancelled" aria-pressed="false">Cancelled</button>
    <button type="button" class="ts-tab" data-event-filter="history" aria-pressed="false">Review History</button>
</nav>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input id="events-search" type="search" aria-label="Search events, organizers or venues"
                class="ts-input" placeholder="Event, organizer or venue"></div><select id="events-sort" class="ts-select" aria-label="Sort events">
            <option value="pending">Pending first</option>
            <option value="newest">Newest submission</option>
        </select>
        <button id="events-refresh" type="button" class="ts-btn ts-btn-secondary ts-btn-sm">Refresh</button>
        <span id="events-count" class="small secondary" role="status" aria-live="polite">Loading submitted events...</span>
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
            <tbody id="events-table-body">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script src="<?=ts_asset_url('assets/js/admin-events.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Event Oversight', 'events', $content, '..', '');
?>
