<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Official resale</div>
                <h1 class="ts-section-title">Create Resale Listing</h1>
                <p class="ts-section-copy">Only eligible, currently owned and unused NFT tickets can be listed.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad" id="resale-form-container">
            <div class="ts-steps">
                <div class="ts-step done"><span class="ts-step-num">✓</span>Ticket</div><span
                    class="ts-step-line"></span>
                <div class="ts-step active"><span class="ts-step-num">2</span>Price</div><span
                    class="ts-step-line"></span>
                <div class="ts-step"><span class="ts-step-num">3</span>Listing</div>
            </div>
            <div class="ts-field mt-24"><label class="ts-label" for="resale-ticket">Ticket to sell</label><select class="ts-select" id="resale-ticket" disabled><option>Loading tickets...</option></select></div>
            <p id="resale-message" role="status" aria-live="polite"></p>
            <div class="ts-grid-2 mt-24">
                <div>
                    <div class="ts-card ts-card-pad">
                        <div class="ts-card-title" id="val-event">Loading...</div>
                        <div class="small secondary mt-8" id="val-ticket-info">...</div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Current owner</div>
                            <div class="ts-detail-value ts-wallet-id" id="val-owner">...</div>
                        </div>
                        <div id="val-status"></div>
                    </div>
                    <div class="ts-alert ts-alert-info mt-16">
                        <?=ts_icon('shield')?>
                        <div><strong>Organizer resale rules</strong>
                            <div class="small mt-8" id="val-rules">Loading rules...</div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="ts-field"><label class="ts-label">Resale Price (RM)</label><input class="ts-input"
                            name="resalePrice" id="input-price" type="number" min="0.01" step="0.01" value="" disabled>
                        <div class="ts-help" id="val-price-help">Loading limits...</div>
                    </div>
                    <div class="ts-card ts-card-pad mt-16">
                        <div class="ts-summary-row"><span>Original price</span><strong id="summary-original">...</strong></div>
                        <div class="ts-summary-row"><span>Your resale price</span><strong id="summary-resale">...</strong></div>
                        <div class="ts-summary-row"><span>Maximum allowed</span><strong id="summary-max">...</strong></div>
                        <div class="ts-alert ts-alert-success mt-12" id="price-alert" style="display:none">
                            <?=ts_icon('check')?>
                            <span id="price-alert-text">Price is within the organizer-defined limit.</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="tickets.php" id="btn-cancel">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit" type="button" disabled>Create listing</button></div>
        </div>
    </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/resale-create.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Create Resale Listing', 'resale', $content, '..', true);
?>
