<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1100px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Booking TS20260001</div>
                <h1 class="ts-section-title">Aurora After Dark</h1>
                <p class="ts-section-copy">Confirmed 17 Aug 2026 · 4:05 PM</p>
            </div>
            <?=ts_status('Confirmed', 'success')?>
        </div>
        <div class="ts-grid-2">
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Booking details</div>
                <div class="ts-detail-grid mt-8">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Category</div>
                        <div class="ts-detail-value">VIP1</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Assigned Seat</div>
                        <div class="ts-detail-value">A06</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Quantity</div>
                        <div class="ts-detail-value">1</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Booking Status</div>
                        <div class="ts-detail-value">Confirmed</div>
                    </div>
                </div><a class="ts-btn ts-btn-primary w-full mt-20" href="ticket-detail.php">Open NFT Ticket</a>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Payment summary</div>
                <div class="ts-summary-row"><span>Subtotal</span><strong>RM688.00</strong></div>
                <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
                <div class="ts-summary-row total"><span>Total Paid</span><span>RM708.00</span></div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Payment status</div>
                    <div class="ts-detail-value">
                        <?=ts_status('Successful', 'success')?>
                    </div>
                </div>
            </div>
        </div>
        <div class="ts-accordion mt-24"><button class="ts-accordion-trigger">Blockchain transaction associated with this
                booking <span
                    class="chev"><?=ts_icon('chevron-down')?></span></button>
            <div class="ts-accordion-panel">
                <div class="ts-detail-grid">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Minting Status</div>
                        <div class="ts-detail-value">
                            <?=ts_status('Confirmed', 'success')?>
                        </div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Transaction Hash</div>
                        <div class="ts-detail-value ts-copy-code">0x98bd…31f7</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Booking TS20260001', 'tickets', $content, '..', true);
?>