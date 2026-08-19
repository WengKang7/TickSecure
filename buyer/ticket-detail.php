<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-content-grid">
            <div class="ts-ticket-pass">
                <div class="ts-ticket-head">
                    <div><small>TickSecure Verified Ticket</small>
                        <div class="ts-ticket-event">Aurora After Dark</div>
                        <div class="small mt-8" style="color:#D0D5DD">18 Oct 2026 · 8:00 PM · Merdeka Hall</div>
                    </div>
                    <?=ts_status('Valid', 'success')?>
                </div>
                <div class="ts-ticket-body">
                    <div class="ts-ticket-grid">
                        <div>
                            <div class="ts-ticket-label">Category</div>
                            <div class="ts-ticket-value">VIP1</div>
                        </div>
                        <div>
                            <div class="ts-ticket-label">Section</div>
                            <div class="ts-ticket-value">Section A</div>
                        </div>
                        <div>
                            <div class="ts-ticket-label">Seat</div>
                            <div class="ts-ticket-value">A06</div>
                        </div>
                    </div>
                    <div class="ts-qr"></div>
                    <div class="text-center small secondary">Present this QR code at event entry. It is validated
                        against current ownership and usage status.</div>
                </div>
            </div>
            <aside>
                <div class="ts-card ts-card-pad">
                    <div class="ts-card-title">Ticket ownership</div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Current owner</div>
                        <div class="ts-detail-value ts-wallet-id">0x12A4…8F92</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Token ID</div>
                        <div class="ts-detail-value">#TS-100184</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Ticket status</div>
                        <div class="ts-detail-value">
                            <?=ts_status('Valid', 'success')?>
                        </div>
                    </div>
                    <div class="ts-grid-2 mt-20"><a class="ts-btn ts-btn-secondary"
                            href="ticket-transfer.php">Transfer</a><a class="ts-btn ts-btn-primary"
                            href="resale-new.php">List for Resale</a></div>
                    <div class="ts-divider"></div><a class="ts-btn ts-btn-tertiary w-full" href="#history">View
                        Ownership History</a>
                    <div class="ts-accordion mt-12"><button class="ts-accordion-trigger">Blockchain details <span
                                class="chev"><?=ts_icon('chevron-down')?></span></button>
                        <div class="ts-accordion-panel">
                            <div class="small secondary">Contract</div>
                            <div class="ts-copy-code mt-8">0x7A19…2E44</div>
                            <div class="small secondary mt-12">Mint transaction</div>
                            <div class="ts-copy-code mt-8">0x98bd…31f7</div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
        <div class="ts-card ts-card-pad mt-24" id="history">
            <div class="ts-card-title">Ownership history</div>
            <div class="ts-timeline mt-20">
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Issued to 0x12A4…8F92</div>
                    <div class="ts-timeline-meta">17 Aug 2026 · NFT mint confirmed</div>
                </div>
                <div class="ts-timeline-item">
                    <div class="ts-timeline-title">Booking TS20260001 confirmed</div>
                    <div class="ts-timeline-meta">17 Aug 2026 · Payment completed</div>
                </div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Digital Ticket', 'tickets', $content, '..', true);
?>