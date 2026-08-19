<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('CMP-2026-0042', 'Resale dispute · Ong Weng Kang · Submitted 14 Aug 2026', '<button class="ts-btn ts-btn-secondary" data-modal-open="confirm-modal">Request More Information</button> <button class="ts-btn ts-btn-danger" data-modal-open="confirm-modal">Reject</button> <button class="ts-btn ts-btn-success" data-modal-open="confirm-modal">Resolve</button>')?>
<div class="ts-content-grid">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="flex justify-between">
                <div class="ts-card-title">Complaint Description</div>
                <?=ts_status('Under Investigation', 'warning')?>
            </div>
            <p class="secondary">The resale transaction was paid successfully but the NFT ownership transfer remained
                pending longer than expected.</p>
            <div class="ts-divider"></div>
            <div class="ts-card-title">Evidence</div>
            <div class="ts-list">
                <div class="ts-list-item">
                    <div class="flex gap-12">
                        <?=ts_icon('file')?>
                        <div>
                            <div class="ts-list-title">payment-receipt.pdf</div>
                            <div class="ts-list-sub">PDF · 284 KB</div>
                        </div>
                    </div><button class="ts-btn ts-btn-secondary ts-btn-sm">Open</button>
                </div>
                <div class="ts-list-item">
                    <div class="flex gap-12">
                        <?=ts_icon('file')?>
                        <div>
                            <div class="ts-list-title">wallet-status.png</div>
                            <div class="ts-list-sub">PNG · 720 KB</div>
                        </div>
                    </div><button class="ts-btn ts-btn-secondary ts-btn-sm">Open</button>
                </div>
            </div>
        </div>
        <div class="ts-card ts-card-pad mt-20">
            <div class="ts-card-title">Status Timeline</div>
            <div class="ts-timeline mt-20">
                <div class="ts-timeline-item">
                    <div class="ts-timeline-title">Submitted</div>
                    <div class="ts-timeline-meta">14 Aug · 09:14</div>
                </div>
                <div class="ts-timeline-item">
                    <div class="ts-timeline-title">Open</div>
                    <div class="ts-timeline-meta">14 Aug · 09:14</div>
                </div>
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Under Investigation</div>
                    <div class="ts-timeline-meta">17 Aug · Admin Account</div>
                </div>
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Related Records</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Booking / Resale</div>
                <div class="ts-detail-value">RS-2026-0144</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Payment</div>
                <div class="ts-detail-value">
                    <?=ts_status('Successful', 'success')?>
                    RM540</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">NFT Ticket</div>
                <div class="ts-detail-value">TS-TK-0048</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Current Owner</div>
                <div class="ts-detail-value ts-wallet-id">0x12A4…8F92</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Blockchain Tx</div>
                <div class="ts-detail-value">
                    <?=ts_status('Pending', 'purple')?>
                </div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Seller Wallet</div>
                <div class="ts-detail-value ts-wallet-id">0x81A3…30F2</div>
            </div>
        </div>
    </aside>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Complaint Investigation', 'complaints', $content, '..', '');
?>