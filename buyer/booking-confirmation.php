<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:880px">
        <div class="ts-card">
            <div class="ts-success-state">
                <div class="ts-success-icon">
                    <?=ts_icon('check', 'ts-icon-xl')?>
                </div>
                <div class="ts-success-title">Booking confirmed</div>
                <p class="ts-success-copy">Your payment has been confirmed and booking TS20260001 has been created. NFT
                    ticket issuance is now being initiated.</p>
                <div class="ts-card ts-card-pad mt-24 text-left">
                    <div class="ts-detail-grid">
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Event</div>
                            <div class="ts-detail-value">Aurora After Dark</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Booking Number</div>
                            <div class="ts-detail-value">TS20260001</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Category</div>
                            <div class="ts-detail-value">VIP1</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Assigned Seat</div>
                            <div class="ts-detail-value">A06</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Paid</div>
                            <div class="ts-detail-value">RM708.00</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">NFT Issuance</div>
                            <div class="ts-detail-value">
                                <?=ts_status('Pending', 'purple')?>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-center gap-12 wrap mt-24"><a class="ts-btn ts-btn-primary"
                        href="booking-detail.php">View Booking</a><a class="ts-btn ts-btn-secondary"
                        href="tickets.php">View My Tickets</a><a class="ts-btn ts-btn-tertiary"
                        href="../public/events.php">Back to Events</a></div>
            </div>
            <div class="ts-accordion" style="margin:0 22px 22px"><button class="ts-accordion-trigger">Technical
                    transaction details <span
                        class="chev"><?=ts_icon('chevron-down')?></span></button>
                <div class="ts-accordion-panel">
                    <div class="ts-detail-grid">
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Transaction</div>
                            <div class="ts-detail-value ts-copy-code">0x98bd…31f7</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Status</div>
                            <div class="ts-detail-value">
                                <?=ts_status('Pending', 'purple')?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Booking Confirmed', 'tickets', $content, '..', true);
?>