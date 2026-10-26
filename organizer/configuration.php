<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Tickets & Rules', 'Configure tickets and explain the rules buyers will see before booking.', '<a class="ts-btn ts-btn-secondary" id="edit-event-details" href="event-new.php">Edit Event Details</a> <button class="ts-btn ts-btn-secondary" id="save-config-draft" disabled>Save Draft</button> <button class="ts-btn ts-btn-primary" id="review-config-btn" disabled>Review & Submit</button>')?>
<p class="small secondary mb-20" id="config-save-status" role="status" aria-live="polite">Save Draft keeps your categories, unfinished category fields, and rules. It does not submit your event.</p>
<div class="ts-alert ts-alert-error mb-20" id="config-error" role="alert" tabindex="-1" hidden></div>
<div class="ts-alert ts-alert-info mb-24">
    <?=ts_icon('layout')?>
    <div><strong>Physical sections come from the Administrator-managed venue layout.</strong>
        <div class="small mt-8">Category names such as VIP1 and CAT1 are event-specific and do not permanently rename
            the venue’s physical sections.</div>
        <div class="small mt-8">Use only the sections you want to sell. Each section's capacity is a maximum, not a required sales quantity. Unused sections and seats can remain off sale.</div>
    </div>
</div>
<div class="ts-card ts-card-pad mb-24">

    <div class="flex justify-between items-center">

        <div>
            <div class="ts-card-title">
                Selected Venue Layout
            </div>

            <div class="ts-card-sub">
                Select a venue in Event Details to configure its layout.
            </div>
        </div>

        <?= ts_status('Active', 'success') ?>

    </div>


    <div id="mini-venue-board" class="ts-reusable-venue-plan" style="max-width:760px; margin: 20px auto; background:var(--bg-alt); border-radius:12px;"></div>
</div>

<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title" id="venue-sections-title">Venue Sections</div>
        <div class="ts-list mt-16" id="venue-sections-list">
            Loading...
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Add / Edit Category</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label" for="catName">Category Name</label><input class="ts-input" id="catName" name="catName" maxlength="80" value=""><div id="catName-error" class="ts-field-error small mt-8" hidden></div>
            </div>
            <div class="ts-field"><label class="ts-label" for="catSection">Physical Venue Section</label><select class="ts-select" id="catSection" name="catSection">
                    <option value="">Select Section...</option>
                </select><div id="catSection-error" class="ts-field-error small mt-8" hidden></div></div>
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label" for="catPrice">Ticket Price (RM)</label><input class="ts-input" type="number" id="catPrice" name="catPrice" min="1" max="99999" step="0.01"
                        value=""><div id="catPrice-error" class="ts-field-error small mt-8" hidden></div></div>
                <div class="ts-field"><label class="ts-label" for="catQuantity">Tickets to Put on Sale</label><input class="ts-input" type="number" id="catQuantity" name="catQuantity" min="1" step="1" value=""><div id="catQuantity-error" class="ts-field-error small mt-8" hidden></div>
                    <div class="ts-help">Choose any quantity from 1 up to the section's capacity. For example, you may sell 25 tickets in a 250-seat section.</div>
                </div>
            </div><button class="ts-btn ts-btn-secondary" id="add-cat-btn" disabled>Add Category</button>
            <button class="ts-btn ts-btn-ghost" id="clear-cat-btn" type="button">Clear Category Fields</button>
            <div class="ts-help">Add or update a category here, then use Save Draft to keep your changes. Review also includes a complete category currently entered here.</div>
        </div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Configured Ticket Categories</div>
            <div class="ts-card-sub">Buyer seat numbers are assigned automatically from the mapped section.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Physical Section</th>
                    <th>Price</th>
                    <th>Tickets for Sale</th>
                    <th>Section Capacity (Maximum)</th>
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
