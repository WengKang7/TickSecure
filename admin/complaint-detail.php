<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<div id="action-buttons" style="display:none;"><button id="btn-investigate" class="ts-btn ts-btn-secondary">Investigate</button> <button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button> <button id="btn-resolve" class="ts-btn ts-btn-success">Resolve</button></div>')?>
<div class="ts-content-grid" id="cmp-detail-container" style="display:none;">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="flex justify-between">
                <div class="ts-card-title">Complaint Description</div>
                <div id="val-status"></div>
            </div>
            <p class="secondary" id="val-desc"></p>
            <div class="ts-divider"></div>
            <div class="ts-card-title">Evidence</div>
            <div class="ts-list" id="evidence-list">
                <div class="text-center secondary">No evidence provided</div>
            </div>
        </div>
        <div class="ts-card ts-card-pad mt-20">
            <div class="ts-card-title">Status Timeline</div>
            <div class="ts-timeline mt-20" id="val-timeline">
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Related Records</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Booking / Resale</div>
                <div class="ts-detail-value" id="val-related">N/A</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Payment</div>
                <div class="ts-detail-value">
                    <span class="ts-chip ts-chip-success">Successful</span>
                    N/A</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">NFT Ticket</div>
                <div class="ts-detail-value ts-wallet-id">0x81A3…30F2</div>
            </div>
        </div>
    </aside>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Complaint Investigation', 'complaints', $content, '..', '');
?>