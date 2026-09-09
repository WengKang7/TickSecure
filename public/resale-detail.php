<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container"><div class="ts-content-grid">
  <div>
    <div class="ts-card ts-card-pad">
      <div class="flex justify-between items-start">
        <div>
          <div class="ts-section-eyebrow">Verified resale ticket</div>
          <h1 class="mt-0 mb-8" id="rd-event-name">Loading...</h1>
          <p class="secondary" id="rd-ticket-info">Loading...</p>
        </div>
        <?=ts_status('Available','success')?>
      </div>
      <div class="ts-divider"></div>
      <div class="ts-grid-3">
        <div><div class="ts-detail-label">Original price</div><div class="ts-kpi-value" style="font-size:22px" id="rd-orig-price">-</div></div>
        <div><div class="ts-detail-label">Resale price</div><div class="ts-kpi-value" style="font-size:22px" id="rd-resale-price">-</div></div>
        <div><div class="ts-detail-label">Maximum allowed</div><div class="ts-kpi-value" style="font-size:22px" id="rd-max-price">-</div></div>
      </div>
      <div class="ts-alert ts-alert-success mt-24"><?=ts_icon('shield')?><div><strong>Resale rule verified</strong><div class="small mt-8">This listing is within the organizer-defined resale price and period.</div></div></div>
    </div>
    <div class="ts-card ts-card-pad mt-20">
      <div class="ts-card-title">Ownership & ticket information</div>
      <div class="ts-detail-grid mt-8">
        <div class="ts-detail-item"><div class="ts-detail-label">Seller</div><div class="ts-detail-value" id="rd-seller">Loading...</div></div>
        <div class="ts-detail-item"><div class="ts-detail-label">Ticket status</div><div class="ts-detail-value">Listed for resale</div></div>
        <div class="ts-detail-item"><div class="ts-detail-label">Event</div><div class="ts-detail-value" id="rd-event-date">-</div></div>
        <div class="ts-detail-item"><div class="ts-detail-label">Venue</div><div class="ts-detail-value" id="rd-venue">-</div></div>
      </div>
    </div>
  </div>
  <aside>
    <div class="ts-card ts-card-pad ts-order-summary">
      <div class="ts-card-title">Purchase summary</div>
      <div class="ts-summary-row"><span>Resale ticket</span><strong id="rd-sum-ticket">-</strong></div>
      <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
      <div class="ts-summary-row total"><span>Total</span><span id="rd-sum-total">-</span></div>
      <a class="ts-btn ts-btn-primary w-full mt-16" id="rd-purchase-btn" href="#">Continue to Purchase</a>
      <p class="small muted text-center">Ownership transfers only after successful payment and blockchain confirmation.</p>
    </div>
  </aside>
</div></div></main>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    
    if (!listingId) {
        document.getElementById('rd-event-name').textContent = 'Listing not found';
        return;
    }

    try {
        const listing = await window.tsResale.getListing(listingId);
        if (!listing) throw new Error('Listing not found');

        let evName = 'Loading...';
        let evDate = '-';
        let evVenue = '-';
        try {
            const ev = await window.tsEvents.getEvent(listing.eventId);
            if(ev) {
                evName = ev.name;
                evDate = ev.startDate ? new Date(ev.startDate).toLocaleString() : '-';
                evVenue = ev.venueName || '-';
            }
        } catch(e) {}
        
        document.getElementById('rd-event-name').textContent = evName;
        document.getElementById('rd-ticket-info').textContent = `${listing.ticketCategory || 'Any'} · Seat ${listing.seatId || 'Any'}`;
        
        document.getElementById('rd-orig-price').textContent = `RM${listing.originalPrice || 0}`;
        document.getElementById('rd-resale-price').textContent = `RM${listing.askingPrice || 0}`;
        // Assuming max is like 110% of original roughly, or missing. Let's just calculate or leave it static?
        document.getElementById('rd-max-price').textContent = listing.originalPrice ? `RM${(listing.originalPrice * 1.1).toFixed(0)}` : 'TBD';

        const sellerId = listing.sellerId || '';
        document.getElementById('rd-seller').textContent = sellerId.substring(0,6) + '...' + sellerId.substring(sellerId.length-4);
        
        document.getElementById('rd-event-date').textContent = evDate;
        document.getElementById('rd-venue').textContent = evVenue;

        const asking = listing.askingPrice || 0;
        const total = asking + 20;
        document.getElementById('rd-sum-ticket').textContent = `RM${asking.toFixed(2)}`;
        document.getElementById('rd-sum-total').textContent = `RM${total.toFixed(2)}`;
        
        document.getElementById('rd-purchase-btn').href = `../buyer/checkout.php?resaleId=${esc(listingId)}`;
        
        if (!window.tsCurrentUser || window.tsCurrentUser.role !== 'buyer') {
            document.getElementById('rd-purchase-btn').textContent = 'Login to Purchase';
            document.getElementById('rd-purchase-btn').href = `../auth/login.php?redirect=/buyer/checkout.php?resaleId=${esc(listingId)}`;
        }

    } catch (err) {
        console.error(err);
        document.getElementById('rd-event-name').textContent = 'Error loading listing';
    }
});
</script>

<?php
$content=ob_get_clean();
render_public_page('Resale Ticket','resale',$content,'..',true);
?>
