<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Tickets & Rules', 'Configure tickets and explain the rules buyers will see before booking.', '<a class="ts-btn ts-btn-secondary" id="edit-event-details" href="event-new.php">Edit Event Details</a> <button class="ts-btn ts-btn-secondary" id="save-config-draft" disabled>Save Draft</button> <button class="ts-btn ts-btn-primary" id="review-config-btn" disabled>Review & Submit</button>')?>
<p class="small secondary mb-20" id="config-save-status" role="status" aria-live="polite">Save Draft keeps your categories, unfinished category fields, and rules. It does not submit your event.</p>
<div class="ts-alert ts-alert-error mb-20" id="config-error" role="alert" tabindex="-1" hidden></div>
<p class="secondary mb-20">Choose seats on the venue plan, give them a category and set a price. Grey seats stay off sale.</p>
<div class="ts-category-workspace">
    <section class="ts-card ts-card-pad ts-category-plan-card">
        <div class="ts-category-plan-header">
            <div>
                <div class="ts-card-title">Assign ticket categories</div>
                <div class="ts-card-sub">Click seats or drag a box to select a group. Use a range for exact numbering.</div>
            </div>
            <div class="ts-category-plan-actions">
                <?= ts_status('Active', 'success') ?>
                <div class="ts-seat-tool-buttons" role="toolbar" aria-label="Seating plan zoom">
                    <button type="button" class="ts-btn ts-btn-secondary ts-btn-sm" id="category-zoom-in" aria-label="Zoom in">+</button>
                    <button type="button" class="ts-btn ts-btn-secondary ts-btn-sm" id="category-zoom-out" aria-label="Zoom out">&minus;</button>
                    <button type="button" class="ts-btn ts-btn-ghost ts-btn-sm" id="category-fit">Fit plan</button>
                </div>
            </div>
        </div>
        <div id="mini-venue-board" class="ts-reusable-venue-plan ts-category-map"></div>
        <details class="ts-simple-details ts-category-sections">
            <summary id="venue-sections-title">Venue sections</summary>
            <div class="ts-list mt-16" id="venue-sections-list">Loading...</div>
        </details>
    </section>
    <aside class="ts-category-sidebar">
        <div class="ts-card ts-card-pad ts-category-form-card">
        <div class="ts-card-title">Ticket category</div>
        <div class="ts-auth-fields ts-category-form mt-20">
            <div class="ts-field"><label class="ts-label" for="catName">Category Name</label><input class="ts-input" id="catName" name="catName" maxlength="80" value=""><div id="catName-error" class="ts-field-error small mt-8" hidden></div>
            </div>
            <div class="ts-field"><label class="ts-label" for="catSection">Venue section</label><select class="ts-select" id="catSection" name="catSection">
                    <option value="">Select Section...</option>
                </select><div id="catSection-error" class="ts-field-error small mt-8" hidden></div></div>
            <div id="seat-category-controls" class="ts-category-seat-controls" hidden>
                <div class="ts-field"><label class="ts-label" for="category-row">Row</label><select class="ts-select" id="category-row"></select></div>
                <div class="ts-form-grid">
                    <div class="ts-field"><label class="ts-label" for="category-from">From seat</label><select class="ts-select" id="category-from"></select></div>
                    <div class="ts-field"><label class="ts-label" for="category-to">To seat</label><select class="ts-select" id="category-to"></select></div>
                </div>
                <button type="button" class="ts-btn ts-btn-secondary w-full" id="category-select-range">Select range</button>
                <div class="ts-category-selection"><strong id="category-selected-count" role="status" aria-live="polite">0 seats selected</strong><button type="button" class="ts-btn ts-btn-ghost ts-btn-sm" id="category-clear-seats">Clear seats</button></div>
                <div class="ts-field"><label class="ts-label" for="category-color">Category colour</label><input id="category-color" type="color" value="#9170ca" class="ts-category-color"></div>
            </div>
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label" for="catPrice">Ticket Price (RM)</label><input class="ts-input" type="number" id="catPrice" name="catPrice" min="1" max="99999" step="0.01"
                        value=""><div id="catPrice-error" class="ts-field-error small mt-8" hidden></div></div>
                <div class="ts-field"><label class="ts-label" for="catQuantity">Seats to sell</label><input class="ts-input" type="number" id="catQuantity" name="catQuantity" min="1" step="1" value=""><div id="catQuantity-error" class="ts-field-error small mt-8" hidden></div>
                    <div class="ts-help" id="legacy-category-note">Choose any quantity from 1 up to the section's capacity. For example, you may sell 25 tickets in a 250-seat section.</div>
                </div>
            </div><button class="ts-btn ts-btn-secondary" id="add-cat-btn" disabled>Add Category</button>
            <button class="ts-btn ts-btn-ghost" id="clear-cat-btn" type="button">Clear Category Fields</button>
            <div class="ts-help">Add this category to colour its seats on the plan. Save Draft keeps your work.</div>
        </div>
    </div>
    </aside>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Configured Ticket Categories</div>
            <div class="ts-card-sub">Buyers choose from the numbered seats assigned to each category.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Seats</th>
                    <th>Price</th>
                    <th>Tickets for Sale</th>
                    <th>Allocation</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="categories-tbody">
                <tr><td colspan="6" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Sales, Transfer & Resale Rules</div>
    <p class="small secondary mt-8">All times use Malaysia time (UTC+8). You can leave these fields unfinished in a draft; complete them before submitting.</p>
    <div class="ts-form-grid mt-20" id="sales-rules-form">
        <div class="ts-field"><label class="ts-label" for="salesStart">Sales Start Date / Time</label><input class="ts-input"
                type="datetime-local" id="salesStart" name="salesStart"><div id="salesStart-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">When buyers can start booking. Choose a time before the event begins.</div></div>
        <div class="ts-field"><label class="ts-label" for="salesEnd">Sales Closing Date / Time</label><input class="ts-input"
                type="datetime-local" id="salesEnd" name="salesEnd"><div id="salesEnd-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">The last time buyers can book. It must be after sales open and no later than the event start.</div></div>
        <div class="ts-field"><label class="ts-label" for="maxTickets">Maximum Tickets per Buyer</label><input class="ts-input" type="number" min="1" step="1"
                id="maxTickets" name="maxTickets" max="20"><div id="maxTickets-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">From 1 to 20 tickets per buyer for this event, across all categories. Purchases, resale purchases, and tickets received by transfer count toward this limit.</div></div>
        <div class="ts-field"><label class="ts-label" for="maxResaleMarkup">Maximum Resale Markup (%)</label><input class="ts-input" type="number"
                id="maxResaleMarkup" name="maxResaleMarkup" min="0" max="100" step="0.01" value="0"><div id="maxResaleMarkup-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">How much higher than the original category price a seller can ask. 0% means no increase; 5% makes a RM100 ticket at most RM105. Checkout fees are separate.</div></div>
        <div class="ts-field"><label class="ts-label" for="resaleStart">Resale Start</label><input class="ts-input" type="datetime-local"
                id="resaleStart" name="resaleStart"><div id="resaleStart-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">When owners can list tickets and buyers can purchase resale tickets. It cannot be before ticket sales open.</div></div>
        <div class="ts-field"><label class="ts-label" for="resaleEnd">Resale Deadline</label><input class="ts-input"
                type="datetime-local" id="resaleEnd" name="resaleEnd"><div id="resaleEnd-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">Resale closes at this time. It must be after resale opens and no later than the event start.</div></div>
        <div class="ts-field"><label class="ts-label" for="maxResalePrice">Fixed Resale Price Cap (RM, optional)</label><input class="ts-input" type="number" id="maxResalePrice" name="maxResalePrice" min="1" max="99999" step="0.01"><div id="maxResalePrice-error" class="ts-field-error small mt-8" hidden></div><div class="ts-help">Leave blank to use the percentage limit. If set, this amount replaces the markup limit for every ticket category.</div></div>
    </div>
    <div class="ts-rule-switches mt-20">
        <div><label class="flex items-center gap-12"><input type="checkbox" id="transferEnabled" name="transferEnabled" checked><strong>Allow ticket transfers</strong></label><p class="ts-help">Owners can give an unused ticket to another verified buyer with a connected wallet. The recipient must have room within the ticket limit.</p>
        </div>
        <div><label class="flex items-center gap-12"><input type="checkbox" id="resaleEnabled" name="resaleEnabled" checked><strong>Allow official resale</strong></label><p class="ts-help">Owners can sell eligible tickets through TickSecure within your resale dates and price limit. Turn this off to prevent resale.</p></div>
    </div>
    <div class="mt-20">
        <button class="ts-btn ts-btn-primary" id="confirm-btn" disabled>Review & Submit for Approval</button>
    </div>
</div>

<script src="<?=ts_asset_url('assets/js/venue-renderer.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/seat-map-interactions.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/seat-category-model.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/organizer-seat-categories.js', '..')?>"></script>
<section class="ts-card ts-card-pad mt-24" aria-labelledby="policy-preview-title">
    <h2 class="ts-card-title" id="policy-preview-title">What buyers will see</h2>
    <p class="small secondary mt-8">This preview updates as you type. Buyers see these rules on the event page after approval.</p>
    <div id="buyer-rules-preview" class="mt-20" aria-live="polite"></div>
</section>
<section class="ts-card ts-card-pad mt-24" id="configuration-review" hidden aria-labelledby="configuration-review-title">
    <h2 class="ts-card-title" id="configuration-review-title">Review before submitting</h2>
    <p id="review-event-summary" class="secondary mt-8"></p>
    <div id="review-category-summary" class="small secondary mt-16"></div>
    <p class="small secondary mt-16">Your event will be sent to the administrator for approval. It stays private until approved. Save Draft if you want to continue editing later.</p>
    <button class="ts-btn ts-btn-primary mt-20" id="submit-config-btn">Submit for Administrator Approval</button>
</section>
<script src="<?=ts_asset_url('assets/js/event-policy.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/organizer-configuration.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Ticket Configuration', 'events', $content, '..', '');
?>
