<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container"><div class="ts-content-grid">
  <div><div class="ts-card ts-card-pad"><div class="flex justify-between items-start"><div><div class="ts-section-eyebrow">Verified resale ticket</div><h1 class="mt-0 mb-8">Aurora After Dark</h1><p class="secondary">VIP1 · Section A · Seat A12</p></div><?=ts_status('Available','success')?></div><div class="ts-divider"></div><div class="ts-grid-3"><div><div class="ts-detail-label">Original price</div><div class="ts-kpi-value" style="font-size:22px">RM688</div></div><div><div class="ts-detail-label">Resale price</div><div class="ts-kpi-value" style="font-size:22px">RM720</div></div><div><div class="ts-detail-label">Maximum allowed</div><div class="ts-kpi-value" style="font-size:22px">RM756</div></div></div><div class="ts-alert ts-alert-success mt-24"><?=ts_icon('shield')?><div><strong>Resale rule verified</strong><div class="small mt-8">This listing is within the organizer-defined resale price and period.</div></div></div></div>
  <div class="ts-card ts-card-pad mt-20"><div class="ts-card-title">Ownership & ticket information</div><div class="ts-detail-grid mt-8"><div class="ts-detail-item"><div class="ts-detail-label">Seller</div><div class="ts-detail-value">0x81A3…30F2</div></div><div class="ts-detail-item"><div class="ts-detail-label">Ticket status</div><div class="ts-detail-value">Listed for resale</div></div><div class="ts-detail-item"><div class="ts-detail-label">Event</div><div class="ts-detail-value">18 Oct 2026 · 8:00 PM</div></div><div class="ts-detail-item"><div class="ts-detail-label">Venue</div><div class="ts-detail-value">Merdeka Hall</div></div></div></div></div>
  <aside><div class="ts-card ts-card-pad ts-order-summary"><div class="ts-card-title">Purchase summary</div><div class="ts-summary-row"><span>Resale ticket</span><strong>RM720.00</strong></div><div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div><div class="ts-summary-row total"><span>Total</span><span>RM740.00</span></div><a class="ts-btn ts-btn-primary w-full mt-16" href="../buyer/checkout.php">Continue to Purchase</a><p class="small muted text-center">Ownership transfers only after successful payment and blockchain confirmation.</p></div></aside>
</div></div></main>

<?php
$content=ob_get_clean();
render_public_page('Resale Ticket','resale',$content,'..',true);
?>
