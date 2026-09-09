<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
  <div class="ts-container">
    <div class="ts-steps">
      <div class="ts-step done"><span class="ts-step-num">✓</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step active"><span class="ts-step-num">2</span>Seat Assignment</div><span
        class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Wallet</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">4</span>Payment</div>
    </div>
    <div class="ts-grid-2">
      <div class="ts-card ts-card-pad">
        <div class="ts-section-eyebrow">Assignment completed</div>
        <h1 class="ts-section-title">Your seat is reserved</h1>
        <p class="secondary">TickSecure selected the first available seat in VIP1 based on the venue section assignment
          order.</p>
        <div class="ts-alert ts-alert-success mt-24" id="assigned-seat-alert">
          <?=ts_icon('check')?>
          <div><strong id="assigned-seat-text">Loading assignment...</strong>
            <div class="small mt-8" id="assigned-seat-sub">Assigning the best available seats...</div>
          </div>
        </div>
        <div class="ts-reservation-bar mt-20" id="reservation-bar" style="display:none">
          <span><?=ts_icon('clock')?> Reservation
            expires in</span><span class="ts-reservation-time" id="countdown-timer">10:00</span></div>
        <div class="ts-seat-pills mt-16" id="seat-pills-container">
           <!-- Dynamic seats -->
        </div>
        <div class="small muted mt-12">Gray seats are unavailable. The highlighted seat is reserved for your checkout
          session.</div>
      </div>
      <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Next: secure your ownership wallet</div>
        <p class="secondary">A supported wallet is required so the NFT ticket can be assigned to the correct owner after
          payment.</p>
        <div class="ts-wallet-card mt-20">
          <div><strong id="wallet-name">MetaMask</strong>
            <div class="small muted mt-8" id="wallet-status">Not connected for this checkout</div>
          </div><span class="ts-chip ts-chip-warning" id="wallet-chip">Required</span>
        </div><a class="ts-btn ts-btn-primary w-full mt-24" href="wallet.php" id="btn-continue">Continue to Wallet</a><a
          class="ts-btn ts-btn-tertiary w-full mt-8" href="booking-category.php">Change Category</a>
      </div>
    </div>
  </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const sectionId = urlParams.get('sectionId');
    const qty = parseInt(urlParams.get('qty') || '1', 10);
    
    if (!eventId || !sectionId) return;
    
    try {
        const available = await window.tsSeats.getAvailableSeats(eventId, sectionId);
        
        if (available.length < qty) {
            document.getElementById('assigned-seat-text').textContent = 'Not enough seats available';
            return;
        }
        
        const reserved = await window.tsSeats.reserveSeats(eventId, sectionId, qty);
        
        document.getElementById('assigned-seat-text').textContent = \`Section \${sectionId} · Seats: \${reserved.map(s => s.seatNumber).join(', ')}\`;
        document.getElementById('assigned-seat-sub').textContent = 'These seats have been reserved for you.';
        
        // Show seats
        const container = document.getElementById('seat-pills-container');
        // Render 12 mock seats just for visual
        let html = '';
        for (let i = 1; i <= 12; i++) {
            const isReserved = i <= qty;
            html += \`<span class="ts-seat-pill \${isReserved ? 'next' : ''}">\${sectionId}\${i.toString().padStart(2, '0')}</span>\`;
        }
        container.innerHTML = html;
        
        document.getElementById('reservation-bar').style.display = 'flex';
        let timeLeft = 600;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) clearInterval(timer);
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('countdown-timer').textContent = \`\${m}:\${s}\`;
        }, 1000);
        
        const profile = window.tsCurrentUser;
        const btnContinue = document.getElementById('btn-continue');
        const walletName = document.getElementById('wallet-name');
        const walletStatus = document.getElementById('wallet-status');
        const walletChip = document.getElementById('wallet-chip');
        
        if (profile.walletAddress) {
            walletName.textContent = 'Wallet Connected';
            walletStatus.textContent = profile.walletAddress;
            walletChip.className = 'ts-chip ts-chip-success';
            walletChip.textContent = 'Ready';
            // Assuming wallet is connected, go to checkout
            btnContinue.textContent = 'Continue to Payment';
            // pass reserved seat ids in url or session. We'll use session for simplicity or URL.
            const seatIds = reserved.map(s => s.id).join(',');
            btnContinue.href = \`checkout.php?eventId=\${eventId}&sectionId=\${sectionId}&qty=\${qty}&seats=\${seatIds}\`;
        } else {
            btnContinue.href = \`wallet.php?redirect=\${encodeURIComponent('checkout.php?eventId='+eventId+'&sectionId='+sectionId+'&qty='+qty)}\`;
        }
        
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Seat Assignment', 'events', $content, '..', true);
?>