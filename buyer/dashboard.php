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
        <div class="ts-kpi-value" id="kpi-tickets">...</div>
        <div class="ts-kpi-label" id="kpi-tickets-label">Loading...</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Bookings</span><span
            class="ts-kpi-icon"><?=ts_icon('calendar')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-bookings">...</div>
        <div class="ts-kpi-label" id="kpi-bookings-label">Loading...</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Resale listings</span><span
            class="ts-kpi-icon"><?=ts_icon('activity')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-resale">...</div>
        <div class="ts-kpi-label" id="kpi-resale-label">Loading...</div>
      </div>
      <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Wallet</span><span
            class="ts-kpi-icon"><?=ts_icon('wallet')?></span>
        </div>
        <div class="ts-kpi-value" style="font-size:18px" id="kpi-wallet">Loading...</div>
        <div class="ts-kpi-label" id="kpi-wallet-label">...</div>
      </div>
    </div>
    <div class="ts-grid-2">
      <div class="ts-card">
        <div class="ts-card-head">
          <div>
            <div class="ts-card-title">Next event</div>
            <div class="ts-card-sub">Your nearest upcoming ticket</div>
          </div><a href="ticket-detail.php" id="next-event-link" class="ts-btn ts-btn-secondary ts-btn-sm" style="display:none">View Ticket</a>
        </div>
        <div class="ts-card-pad" id="next-event-container">
          <p class="secondary text-center" style="padding:20px">Loading...</p>
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
          <div class="ts-list" id="notifications-list">
             <p class="secondary text-center" style="padding:20px">Loading...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const tickets = await window.tsTickets.getUserTickets();
        const bookings = await window.tsBookings.getUserBookings();
        const resale = window.tsResale ? await window.tsResale.getUserListings() : [];
        const notifs = window.tsNotifications ? await window.tsNotifications.getForUser() : [];
        
        const activeTickets = tickets.filter(t => t.status === 'valid');
        document.getElementById('kpi-tickets').textContent = activeTickets.length;
        document.getElementById('kpi-tickets-label').textContent = activeTickets.length + ' active tickets';
        
        document.getElementById('kpi-bookings').textContent = bookings.length;
        document.getElementById('kpi-bookings-label').textContent = 'All-time bookings';
        
        const activeResale = resale.filter(r => r.status === 'active');
        document.getElementById('kpi-resale').textContent = activeResale.length;
        document.getElementById('kpi-resale-label').textContent = activeResale.length + ' active listings';
        
        const profile = window.tsCurrentUser;
        if (profile.walletAddress) {
            document.getElementById('kpi-wallet').textContent = 'Connected';
            document.getElementById('kpi-wallet-label').textContent = profile.walletAddress.substring(0, 6) + '...' + profile.walletAddress.substring(profile.walletAddress.length - 4);
        } else {
            document.getElementById('kpi-wallet').textContent = 'Not Connected';
            document.getElementById('kpi-wallet-label').textContent = 'Link in Profile';
        }
        
        const nextContainer = document.getElementById('next-event-container');
        if (activeTickets.length > 0) {
            const nextTicket = activeTickets[0]; // simplistic assumption
            document.getElementById('next-event-link').href = 'ticket-detail.php?id=' + nextTicket.id;
            document.getElementById('next-event-link').style.display = 'inline-flex';
            nextContainer.innerHTML = `
              <div class="ts-ticket-card">
                <div class="ts-ticket-thumb">${nextTicket.eventName}</div>
                <div class="ts-ticket-card-body">
                  <div class="ts-card-title">${nextTicket.eventName}</div>
                  <div class="small secondary mt-8">${nextTicket.eventDate || 'Upcoming'}</div>
                  <div class="flex items-center gap-8 mt-16">
                    <span class="ts-chip ts-chip-success">Valid</span>
                    <span class="small secondary">${nextTicket.category} · Seat ${nextTicket.seat}</span></div>
                </div>
              </div>
            `;
        } else {
            nextContainer.innerHTML = '<p class="secondary text-center" style="padding:20px">No upcoming events.</p>';
        }
        
        const notifList = document.getElementById('notifications-list');
        if (notifs.length > 0) {
            notifList.innerHTML = notifs.slice(0,3).map(n => `
                <div class="ts-list-item">
                  <div>
                    <div class="ts-list-title">${n.title}</div>
                    <div class="ts-list-sub">${n.message}</div>
                  </div>
                </div>
            `).join('');
        } else {
            notifList.innerHTML = '<p class="secondary text-center" style="padding:20px">No notifications.</p>';
        }
        
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Buyer Dashboard', 'events', $content, '..', true);
?>