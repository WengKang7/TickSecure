<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Review Event Submission', 'Nocturne City · Submitted by Nova Stage Entertainment', '<button class="ts-btn ts-btn-secondary" data-modal-open="confirm-modal">Request Correction</button> <button class="ts-btn ts-btn-danger" data-modal-open="confirm-modal">Reject</button> <button class="ts-btn ts-btn-success" data-modal-open="confirm-modal">Approve</button>')?>
<div class="ts-content-grid">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="ts-section-eyebrow">Buyer preview</div>
            <div class="ts-event-hero-detail" style="grid-template-columns:260px 1fr;gap:28px">
                <div class="ts-poster" style="min-height:320px">
                    <div class="ts-poster-copy">
                        <div class="ts-poster-kicker">Nova Stage</div>
                        <div class="ts-poster-title">Nocturne<br>City</div>
                    </div>
                </div>
                <div>
                    <h2 class="mt-0">Nocturne City</h2>
                    <p class="secondary">12 Dec 2026 · 9:00 PM · Merdeka Hall</p>
                    <p class="secondary">A late-night performance experience with premium production and controlled
                        digital ticketing.</p>
                    <div class="flex gap-8 wrap mt-16">
                        <?=ts_status('Pending Approval', 'warning')?><span
                            class="ts-chip ts-chip-neutral">Concert</span></div>
                </div>
            </div>
        </div>
        <div class="ts-card mt-20">
            <div class="ts-card-head">
                <div>
                    <div class="ts-card-title">Ticket Categories</div>
                    <div class="ts-card-sub">Mapped to Administrator-managed venue sections</div>
                </div>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Price</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>VIP1</td>
                            <td>Section A</td>
                            <td>RM568</td>
                            <td>20</td>
                        </tr>
                        <tr>
                            <td>CAT1</td>
                            <td>Section B</td>
                            <td>RM388</td>
                            <td>40</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Submission Summary</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Organizer</div>
                <div class="ts-detail-value">Nova Stage Entertainment</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Venue Layout</div>
                <div class="ts-detail-value">
                    <?=ts_status('Active / Verified', 'success')?>
                </div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Sales Period</div>
                <div class="ts-detail-value">01 Oct – 12 Dec</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Max / Buyer</div>
                <div class="ts-detail-value">4 tickets</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Resale</div>
                <div class="ts-detail-value">Enabled · max RM624</div>
            </div>
        </div>
        <div class="ts-alert ts-alert-warning mt-20">
            <?=ts_icon('alert')?>
            <div><strong>Review note</strong>
                <div class="small mt-8">Event approval controls whether the event becomes visible and purchasable by
                    Buyers.</div>
            </div>
        </div>
    </aside>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Review Event', 'events', $content, '..', '');
?>