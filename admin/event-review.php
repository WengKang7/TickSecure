<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading event...', 'Review the submitted details before making a decision.', '<a class="ts-btn ts-btn-secondary" href="events.php">Back to Events</a><div id="action-buttons" class="flex gap-8" hidden><button id="btn-suspend" class="ts-btn ts-btn-secondary" hidden>Suspend</button><button id="btn-reject" class="ts-btn ts-btn-danger" hidden>Reject</button><button id="btn-approve" class="ts-btn ts-btn-success" hidden>Approve</button></div>')?>
<div id="review-error" class="ts-alert ts-alert-error mb-24" role="alert" tabindex="-1" hidden></div>
<button id="review-retry" type="button" class="ts-btn ts-btn-secondary mb-24" hidden>Reload Event</button>
<div id="review-notice" class="ts-alert ts-alert-warning mb-24" role="status" hidden></div>
<div id="event-detail-container" class="ts-review-layout" hidden>
    <div class="ts-review-main">
        <section class="ts-card ts-card-pad" aria-labelledby="review-overview-heading">
            <div class="ts-section-eyebrow">Submitted event details</div>
            <div class="ts-review-overview mt-16">
                <div>
                    <div class="ts-poster ts-review-poster">
                        <img id="val-poster" alt="" hidden>
                        <div id="poster-copy" class="ts-poster-copy"><div class="ts-poster-kicker" id="poster-org"></div><div class="ts-poster-title" id="poster-title"></div></div>
                    </div>
                    <a id="poster-link" class="ts-btn ts-btn-secondary ts-btn-sm mt-12" target="_blank" rel="noopener noreferrer" hidden>View Full Poster</a>
                </div>
                <div>
                    <h2 class="mt-0" id="review-overview-heading">Event overview</h2>
                    <div class="flex gap-8 wrap mb-16" id="val-badges"></div>
                    <dl class="ts-review-facts">
                        <div><dt>Event date and start time</dt><dd id="val-schedule"></dd></div>
                        <div><dt>Event category</dt><dd id="val-category"></dd></div>
                        <div><dt>Selected venue</dt><dd id="val-venue-name"></dd></div>
                        <div><dt>Event venue address</dt><dd id="val-location"></dd></div>
                    </dl>
                    <p class="small secondary mt-16">All dates and times on this page use Malaysia time (UTC+8).</p>
                </div>
            </div>
            <div class="ts-review-description"><h3 class="ts-card-title">Event Description</h3><p id="val-desc" class="secondary"></p></div>
        </section>

        <section class="ts-card" aria-labelledby="review-tickets-heading">
            <div class="ts-card-head"><div><h2 class="ts-card-title" id="review-tickets-heading">Ticket Categories &amp; Allocation</h2><p class="ts-card-sub">Only the quantities below are offered for this event. Unused seats and sections can stay off sale.</p></div></div>
            <div class="ts-review-totals" id="ticket-totals"></div>
            <div class="ts-table-wrap"><table class="ts-table">
                <thead><tr><th>Ticket Category</th><th>Physical Section</th><th>Price per Ticket</th><th>Tickets Offered</th><th>Section Capacity (Maximum)</th></tr></thead>
                <tbody id="ticket-table-body"></tbody>
            </table></div>
            <p class="ts-review-footnote small secondary">The section capacity is an upper limit. The organizer does not need to sell every seat. Seat numbers are assigned automatically within the mapped section.</p>
        </section>

        <section class="ts-card ts-card-pad" aria-labelledby="review-rules-heading">
            <h2 class="ts-card-title" id="review-rules-heading">Sales, Transfer &amp; Resale Rules</h2>
            <p class="ts-card-sub mb-20">The same plain-language rules buyers see before purchasing, including resale price examples for each category.</p>
            <div id="review-rules"></div>
        </section>

        <section class="ts-card ts-card-pad" aria-labelledby="review-layout-heading">
            <h2 class="ts-card-title" id="review-layout-heading">Selected Venue Layout</h2>
            <p id="val-layout-status" class="small secondary mt-8"></p>
            <p class="small secondary">Physical sections are shown as a schematic. Ticket category names do not rename these sections.</p>
            <div id="review-venue-board" class="ts-reusable-venue-plan mt-20" hidden></div>
            <a id="venue-link" class="ts-btn ts-btn-secondary ts-btn-sm mt-16" hidden>Open Venue Layout</a>
        </section>

        <section class="ts-card ts-card-pad" aria-labelledby="review-history-heading">
            <h2 class="ts-card-title" id="review-history-heading">Submission &amp; Decision History</h2>
            <div class="ts-timeline mt-20" id="review-history"></div>
        </section>
    </div>
    <aside class="ts-review-aside">
        <section class="ts-card ts-card-pad" aria-labelledby="review-submission-heading">
            <h2 class="ts-card-title" id="review-submission-heading">Submission Summary</h2>
            <dl class="ts-review-facts ts-review-facts-single mt-16">
                <div><dt>Current status</dt><dd id="val-status"></dd></div>
                <div><dt>Created</dt><dd id="val-created"></dd></div>
                <div><dt>Submitted for approval</dt><dd id="val-submitted"></dd></div>
                <div><dt>Last updated</dt><dd id="val-updated"></dd></div>
            </dl>
            <p class="small secondary mt-20">Approving publishes the event. Buyers can purchase during its configured sales window. Rejection and suspension require a reason.</p>
        </section>
        <section class="ts-card ts-card-pad" aria-labelledby="review-organizer-heading">
            <h2 class="ts-card-title" id="review-organizer-heading">Organizer Contact</h2>
            <dl class="ts-review-facts ts-review-facts-single mt-16">
                <div><dt>Submitted by</dt><dd id="val-org-name"></dd></div>
                <div><dt>Organization</dt><dd id="val-org-company"></dd></div>
                <div><dt>Email</dt><dd id="val-org-email"></dd></div>
                <div><dt>Phone</dt><dd id="val-org-phone"></dd></div>
                <div><dt>Organization address</dt><dd id="val-org-address"></dd></div>
                <div><dt>Account status</dt><dd id="val-org-status"></dd></div>
            </dl>
            <a id="organizer-link" class="ts-btn ts-btn-secondary ts-btn-sm mt-20" hidden>View Organizer Profile</a>
        </section>
    </aside>
</div>

<script src="<?=ts_asset_url('assets/js/event-policy.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/venue-renderer.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/seat-category-model.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/admin-event-review.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Review Event', 'events', $content, '..', '');
?>
