<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Aurora After Dark', '18 Oct 2026 · Merdeka Hall · Last updated today', '<a class="ts-btn ts-btn-secondary" href="../public/event-detail.php">'.ts_icon('eye').' Preview Public Page</a> <button class="ts-btn ts-btn-primary" data-toast="Edit event UI opened">Edit Event</button>')?>
<div class="flex gap-8 wrap mb-24">
    <?=ts_status('Published', 'success')?><?=ts_status('Sales Open', 'info')?><?=ts_status('Resale Enabled', 'gold')?>
</div>
<div data-tabs>
    <div class="ts-tabs"><button class="ts-tab active" data-tab="overview">Overview</button><button class="ts-tab"
            data-tab="tickets">Ticket Configuration</button><button class="ts-tab" data-tab="rules">Sales
            Rules</button><button class="ts-tab" data-tab="history">Status History</button><button class="ts-tab"
            data-tab="sales">Sales</button></div>
    <div class="ts-tab-panel active" data-panel="overview">
        <div class="ts-grid-3">
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Venue</div>
                <div class="ts-card-title mt-8">Merdeka Hall</div>
                <p class="small muted">Kuala Lumpur · active processed layout</p>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Tickets Sold</div>
                <div class="ts-kpi-value">1,244</div>
                <p class="small muted">of 1,600 allocated</p>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-detail-label">Revenue</div>
                <div class="ts-kpi-value">RM714K</div>
                <p class="small muted">Initial sales</p>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="tickets">
        <div class="ts-card">
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Available</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>VIP1</td>
                            <td>Section A</td>
                            <td>RM688</td>
                            <td>20</td>
                            <td>18</td>
                        </tr>
                        <tr>
                            <td>CAT1</td>
                            <td>Section B</td>
                            <td>RM488</td>
                            <td>40</td>
                            <td>9</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="rules">
        <div class="ts-card ts-card-pad">
            <div class="ts-detail-grid">
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Sales Start</div>
                    <div class="ts-detail-value">01 Sep 2026 · 10:00</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Sales Close</div>
                    <div class="ts-detail-value">18 Oct 2026 · 18:00</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Max / Buyer</div>
                    <div class="ts-detail-value">4 tickets</div>
                </div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Resale Maximum</div>
                    <div class="ts-detail-value">RM756</div>
                </div>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="history">
        <div class="ts-card ts-card-pad">
            <div class="ts-timeline">
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Approved → Published</div>
                    <div class="ts-timeline-meta">15 Aug 2026 · Administrator · Sales configuration confirmed</div>
                </div>
                <div class="ts-timeline-item">
                    <div class="ts-timeline-title">Pending Approval → Approved</div>
                    <div class="ts-timeline-meta">14 Aug 2026 · Administrator</div>
                </div>
                <div class="ts-timeline-item">
                    <div class="ts-timeline-title">Draft → Pending Approval</div>
                    <div class="ts-timeline-meta">12 Aug 2026 · Nova Stage Entertainment</div>
                </div>
            </div>
        </div>
    </div>
    <div class="ts-tab-panel" data-panel="sales"><a class="ts-btn ts-btn-primary" href="sales.php">Open Sales
            Dashboard</a></div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Aurora After Dark', 'events', $content, '..', '');
?>