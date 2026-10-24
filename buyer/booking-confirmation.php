<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight ts-confirmation-page">
    <div class="ts-container" style="max-width:880px">
        <div class="ts-card">
            <div class="ts-success-state">
                <div class="ts-success-icon" id="booking-success-icon" hidden>
                    <?=ts_icon('check', 'ts-icon-xl')?>
                </div>
                <div class="ts-success-title" id="confirmation-title">Loading booking...</div>
                <p class="ts-success-copy" id="success-copy">Your booking is being loaded.</p>
                <div class="ts-card ts-card-pad mt-24 text-left" id="confirmation-details" hidden>
                    <div class="ts-detail-grid">
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Event</div>
                            <div class="ts-detail-value" id="val-event">Loading...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Booking Number</div>
                            <div class="ts-detail-value" id="val-booking-id">...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Category</div>
                            <div class="ts-detail-value" id="val-category">...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Assigned Seat</div>
                            <div class="ts-detail-value" id="val-seat">...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Paid</div>
                            <div class="ts-detail-value" id="val-paid">...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">NFT Issuance</div>
                            <div class="ts-detail-value" id="val-nft-status">
                                <?=ts_status('Pending', 'purple')?>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-center gap-12 wrap mt-24"><a class="ts-btn ts-btn-primary"
                        href="bookings.php" id="btn-view-booking" hidden>View Booking</a><a class="ts-btn ts-btn-secondary"
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
                            <div class="ts-detail-value ts-copy-code" id="val-tx">Loading...</div>
                        </div>
                        <div class="ts-detail-item">
                            <div class="ts-detail-label">Status</div>
                            <div class="ts-detail-value" id="val-tx-status">
                                <?=ts_status('Pending', 'purple')?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</main>

<script type="module" src="<?=ts_asset_url('assets/js/booking-confirmation.js', '..')?>"></script>

<?php
$content = ob_get_clean();
render_public_page('Booking Confirmed', 'tickets', $content, '..', true);
?>
