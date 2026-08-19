<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
  <div class="ts-container">
    <div class="ts-section-title-row">
      <div>
        <div class="ts-section-eyebrow">Buyer account</div>
        <h1 class="ts-section-title">Welcome back, Guan Hong</h1>
        <p class="ts-section-copy">Your upcoming tickets, active reservations and account status in one place.</p>
      </div><a class="ts-btn ts-btn-primary" href="../public/events.php">Browse Events</a>
    </div>
    <div class="ts-grid-4 mb-24">
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Active tickets</span><span
            class="ts-kpi-icon"><?=ts_icon('ticket')?></span>
        </div>
        <div class="ts-kpi-value">3</div>
        <div class="ts-kpi-label">2 upcoming events</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Bookings</span><span
            class="ts-kpi-icon"><?=ts_icon('calendar')?></span>
        </div>
        <div class="ts-kpi-value">5</div>
        <div class="ts-kpi-label">All-time bookings</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Resale listings</span><span
            class="ts-kpi-icon"><?=ts_icon('activity')?></span>
        </div>
        <div class="ts-kpi-value">1</div>
        <div class="ts-kpi-label">1 active listing</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Wallet</span><span
            class="ts-kpi-icon"><?=ts_icon('wallet')?></span>
        </div>
        <div class="ts-kpi-value" style="font-size:18px">Connected</div>
        <div class="ts-kpi-label">0x12A4…8F92</div>
      </div>
    </div>
    <div class="ts-grid-2">
      <div class="ts-card">
        <div class="ts-card-head">
          <div>
            <div class="ts-card-title">Next event</div>
            <div class="ts-card-sub">Your nearest upcoming ticket</div>
          </div><a href="ticket-detail.php" class="ts-btn ts-btn-secondary ts-btn-sm">View Ticket</a>
        </div>
        <div class="ts-card-pad">
          <div class="ts-ticket-card">
            <div class="ts-ticket-thumb">Aurora<br>After Dark</div>
            <div class="ts-ticket-card-body">
              <div class="ts-card-title">Aurora After Dark</div>
              <div class="small secondary mt-8">18 Oct 2026 · Merdeka Hall</div>
              <div class="flex items-center gap-8 mt-16">
                <?=ts_status('Valid', 'success')?>
                <span class="small secondary">VIP1 · Seat A06</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="ts-card">
        <div class="ts-card-head">
          <div>
            <div class="ts-card-title">Recent notifications</div>
            <div class="ts-card-sub">Important ticket and event updates</div>
          </div><a href="notifications.php" class="small">View all</a>
        </div>
        <div class="ts-card-pad">
          <div class="ts-list">
            <div class="ts-list-item">
              <div>
                <div class="ts-list-title">NFT ticket issued</div>
                <div class="ts-list-sub">Aurora After Dark · 14 minutes ago</div>
              </div>
              <?=ts_status('New', 'info')?>
            </div>
            <div class="ts-list-item">
              <div>
                <div class="ts-list-title">Booking confirmed</div>
                <div class="ts-list-sub">TS20260001 · Today</div>
              </div>
              <?=ts_status('Confirmed', 'success')?>
            </div>
            <div class="ts-list-item">
              <div>
                <div class="ts-list-title">Resale listing active</div>
                <div class="ts-list-sub">Velvet Hour Live · Yesterday</div>
              </div>
              <?=ts_status('Active', 'gold')?>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Buyer Dashboard', 'events', $content, '..', true);
?>