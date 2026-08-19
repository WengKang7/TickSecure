<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Ticket Configuration', 'Map event-specific ticket categories to physical venue sections, then define price and quantity.', '<button class="ts-btn ts-btn-secondary" data-toast="Configuration saved as draft">Save Draft</button> <button class="ts-btn ts-btn-primary" data-modal-open="confirm-modal">Confirm Configuration</button>')?>
<div class="ts-alert ts-alert-info mb-24">
    <?=ts_icon('layout')?>
    <div><strong>Physical sections come from the Administrator-managed venue layout.</strong>
        <div class="small mt-8">Category names such as VIP1 and CAT1 are event-specific and do not permanently rename
            the venue’s physical sections.</div>
    </div>
</div>
<div class="ts-card ts-card-pad mb-24">

    <div class="flex justify-between items-center">

        <div>
            <div class="ts-card-title">
                Selected Venue Layout
            </div>

            <div class="ts-card-sub">
                Merdeka Hall · Administrator-managed physical layout
            </div>
        </div>

        <?= ts_status('Active', 'success') ?>

    </div>


    <div
        class="ts-mini-venue-layout mt-20"
        style="max-width:760px; margin-left:auto; margin-right:auto;"
    >

        <div class="ts-mini-stage">
            STAGE
        </div>

        <div class="ts-mini-section mini-a">
            <strong>Section A</strong>
            <span>20 seats</span>
        </div>

        <div class="ts-mini-section mini-b">
            <strong>Section B</strong>
            <span>40 seats</span>
        </div>

        <div class="ts-mini-section mini-c">
            <strong>Section C</strong>
            <span>60 seats</span>
        </div>

    </div>

</div>
<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Venue Sections · Merdeka Hall</div>
        <div class="ts-list mt-16">
            <div class="ts-list-item">
                <div>
                    <div class="ts-list-title">Section A</div>
                    <div class="ts-list-sub">20 seats · available for mapping</div>
                </div>
                <?=ts_status('Mapped to VIP1', 'gold')?>
            </div>
            <div class="ts-list-item">
                <div>
                    <div class="ts-list-title">Section B</div>
                    <div class="ts-list-sub">40 seats · available for mapping</div>
                </div>
                <?=ts_status('Mapped to CAT1', 'gold')?>
            </div>
            <div class="ts-list-item">
                <div>
                    <div class="ts-list-title">Section C</div>
                    <div class="ts-list-sub">60 seats · available for mapping</div>
                </div>
                <?=ts_status('Mapped to CAT2', 'gold')?>
            </div>
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Add / Edit Category</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Category Name</label><input class="ts-input" value="VIP1">
            </div>
            <div class="ts-field"><label class="ts-label">Physical Venue Section</label><select class="ts-select">
                    <option>Section A · 20 seats</option>
                    <option>Section B · 40 seats</option>
                    <option>Section C · 60 seats</option>
                </select></div>
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label">Ticket Price (RM)</label><input class="ts-input"
                        value="688.00"></div>
                <div class="ts-field"><label class="ts-label">Ticket Quantity</label><input class="ts-input" value="20">
                </div>
            </div><button class="ts-btn ts-btn-secondary" data-toast="Category added to UI preview">Add
                Category</button>
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
                    <th>Quantity</th>
                    <th>Capacity Check</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cell-title">VIP1</td>
                    <td>Section A</td>
                    <td>RM688</td>
                    <td>20</td>
                    <td><?=ts_status('Valid', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Edit</button></td>
                </tr>
                <tr>
                    <td class="cell-title">CAT1</td>
                    <td>Section B</td>
                    <td>RM488</td>
                    <td>40</td>
                    <td><?=ts_status('Valid', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Edit</button></td>
                </tr>
                <tr>
                    <td class="cell-title">CAT2</td>
                    <td>Section C</td>
                    <td>RM288</td>
                    <td>60</td>
                    <td><?=ts_status('Valid', 'success')?>
                    </td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">Edit</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Sales, Transfer & Resale Rules</div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field"><label class="ts-label">Sales Start Date / Time</label><input class="ts-input"
                type="datetime-local" value="2026-09-01T10:00"></div>
        <div class="ts-field"><label class="ts-label">Sales Closing Date / Time</label><input class="ts-input"
                type="datetime-local" value="2026-10-18T18:00"></div>
        <div class="ts-field"><label class="ts-label">Maximum Tickets per Buyer</label><input class="ts-input"
                value="4"></div>
        <div class="ts-field"><label class="ts-label">Maximum Resale Price (RM)</label><input class="ts-input"
                value="756.00"></div>
        <div class="ts-field"><label class="ts-label">Resale Start</label><input class="ts-input" type="datetime-local"
                value="2026-09-15T00:00"></div>
        <div class="ts-field"><label class="ts-label">Resale Deadline</label><input class="ts-input"
                type="datetime-local" value="2026-10-17T18:00"></div>
    </div>
    <div class="flex gap-24 mt-20">
        <div class="flex items-center gap-12"><span class="ts-toggle is-on"></span><strong>Transfer Enabled</strong>
        </div>
        <div class="flex items-center gap-12"><span class="ts-toggle is-on"></span><strong>Resale Enabled</strong></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Ticket Configuration', 'events', $content, '..', '');
?>