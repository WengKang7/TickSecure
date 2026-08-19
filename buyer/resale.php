<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Seller centre</div>
                <h1 class="ts-section-title">My Resale Listings</h1>
                <p class="ts-section-copy">Manage eligible NFT tickets listed on TickSecure's controlled secondary
                    market.</p>
            </div><a class="ts-btn ts-btn-primary" href="resale-new.php">Create Listing</a>
        </div>
        <div class="ts-tabs mb-24"><button class="ts-tab active">Active</button><button
                class="ts-tab">Sold</button><button class="ts-tab">Cancelled</button><button
                class="ts-tab">Suspended</button></div>
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Ticket</th>
                            <th>Event</th>
                            <th>Original</th>
                            <th>Listing Price</th>
                            <th>Listed</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="cell-title">TS-TK-0048<div class="cell-sub">VIP2 · C04</div>
                            </td>
                            <td>Midnight Resonance</td>
                            <td>RM518</td>
                            <td>RM540</td>
                            <td>17 Aug 2026</td>
                            <td><?=ts_status('Active', 'success')?>
                            </td>
                            <td>
                                <div class="ts-table-actions"><button class="ts-btn ts-btn-secondary ts-btn-sm"
                                        data-toast="Edit price UI opened">Edit Price</button><button
                                        class="ts-btn ts-btn-danger ts-btn-sm"
                                        data-modal-open="confirm-modal">Cancel</button></div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('My Resale Listings', 'resale', $content, '..', true);
?>