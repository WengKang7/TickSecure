<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">CMP-2026-0042</div>
                <h1 class="ts-section-title">Resale dispute</h1>
                <p class="ts-section-copy">Submitted 14 Aug 2026 · Last updated 17 Aug 2026</p>
            </div>
            <?=ts_status('Under Investigation', 'warning')?>
        </div>
        <div class="ts-content-grid">
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Complaint details</div>
                <p class="secondary">The resale transaction was paid successfully but the ownership transfer remained
                    pending longer than expected. Please verify the blockchain transaction status.</p>
                <div class="ts-divider"></div>
                <div class="ts-card-title">Progress</div>
                <div class="ts-timeline mt-20">
                    <div class="ts-timeline-item">
                        <div class="ts-timeline-title">Submitted</div>
                        <div class="ts-timeline-meta">14 Aug · 9:14 AM</div>
                    </div>
                    <div class="ts-timeline-item">
                        <div class="ts-timeline-title">Open</div>
                        <div class="ts-timeline-meta">Administrator queue</div>
                    </div>
                    <div class="ts-timeline-item current">
                        <div class="ts-timeline-title">Under Investigation</div>
                        <div class="ts-timeline-meta">Related payment and blockchain records are being reviewed.</div>
                    </div>
                </div>
            </div>
            <aside>
                <div class="ts-card ts-card-pad">
                    <div class="ts-card-title">Related information</div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Booking</div>
                        <div class="ts-detail-value">RS-2026-0144</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Ticket</div>
                        <div class="ts-detail-value">TS-TK-0048</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Priority</div>
                        <div class="ts-detail-value">Normal</div>
                    </div><button class="ts-btn ts-btn-secondary w-full mt-20"
                        data-toast="Additional information panel opened">Provide Additional Information</button>
                </div>
            </aside>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Complaint CMP-2026-0042', 'tickets', $content, '..', true);
?>