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
        <p class="secondary">TickSecure assigns the first available seats in your selected category using the venue section assignment order.</p>
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
        <div class="small muted mt-12">The highlighted seats are reserved only for your checkout session.</div>
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

<script type="text/plain" data-legacy-seat-assignment-script>
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

<script type="module">
const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const asAmount = value => {
    const amount = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
};

const findCategory = (rawCategories, sectionId, sectionIdsByName = new Map()) => {
    const entries = Array.isArray(rawCategories)
        ? rawCategories.map((category, index) => [
            category?.sectionId ?? category?.id ?? category?.section ?? String(index),
            category
        ])
        : Object.entries(rawCategories || {});

    return entries.map(([key, category]) => {
        const legacySection = String(category?.sectionId ?? category?.id ?? category?.section ?? key ?? '').trim();
        const canonicalSectionId = sectionIdsByName.get(legacySection.toLowerCase()) || legacySection;
        return {
            sectionId: canonicalSectionId,
            name: String(category?.name ?? category?.categoryName ?? canonicalSectionId).trim() || canonicalSectionId,
            quantity: Math.max(0, Math.floor(asAmount(category?.quantity ?? category?.available)))
        };
    }).find(category => category.sectionId === sectionId) || null;
};

const reservationStorageKey = (eventId, sectionId, quantity) =>
    `ts-seat-reservation:${eventId}:${sectionId}:${quantity}`;

const readStoredReservation = key => {
    try {
        const reservation = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (!reservation || !Array.isArray(reservation.seatDocIds) || !Array.isArray(reservation.seatLabels)) return null;
        const expiresAt = Date.parse(reservation.reservationExpiry || '');
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
        return reservation;
    } catch (_) {
        return null;
    }
};

let initialized = false;
const initializeSeatAssignment = async () => {
    if (initialized) return;
    initialized = true;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = String(urlParams.get('eventId') || '').trim();
    const sectionId = String(urlParams.get('sectionId') || '').trim();
    const requestedQuantity = Math.max(1, parseInt(urlParams.get('qty'), 10) || 1);
    const assignedText = document.getElementById('assigned-seat-text');
    const assignedSubtext = document.getElementById('assigned-seat-sub');
    const seatContainer = document.getElementById('seat-pills-container');
    const reservationBar = document.getElementById('reservation-bar');
    const countdown = document.getElementById('countdown-timer');
    const continueButton = document.getElementById('btn-continue');

    const disableContinue = label => {
        continueButton.textContent = label;
        continueButton.removeAttribute('href');
        continueButton.setAttribute('aria-disabled', 'true');
        continueButton.style.pointerEvents = 'none';
        continueButton.style.opacity = '0.55';
    };
    const enableContinue = (label, href) => {
        continueButton.textContent = label;
        continueButton.href = href;
        continueButton.removeAttribute('aria-disabled');
        continueButton.style.pointerEvents = '';
        continueButton.style.opacity = '';
    };

    if (!eventId || !sectionId) {
        assignedText.textContent = 'Choose a ticket category first';
        assignedSubtext.textContent = 'Return to category selection to reserve seats.';
        disableContinue('Choose a Category');
        return;
    }

    try {
        disableContinue('Assigning Seats…');
        const event = await window.tsEvents.getEvent(eventId);
        if (!event?.venueId) throw new Error('The event venue is unavailable.');

        const venue = await window.tsVenues.getVenue(event.venueId);
        const sectionIdsByName = new Map();
        (venue?.sections || []).forEach(section => {
            const physicalSectionId = String(section.sectionId ?? '').trim();
            if (!physicalSectionId) return;
            sectionIdsByName.set(physicalSectionId.toLowerCase(), physicalSectionId);
            sectionIdsByName.set(String(section.name ?? '').trim().toLowerCase(), physicalSectionId);
        });

        const category = findCategory(event.categories, sectionId, sectionIdsByName);
        if (!category) throw new Error('The selected ticket category is no longer available.');
        const maxPerBuyer = Math.max(1, parseInt(event.maxTicketsPerBuyer, 10) || 4);
        const quantity = Math.min(requestedQuantity, maxPerBuyer, category.quantity);
        if (quantity < 1) throw new Error('No tickets are currently available in this category.');

        const storageKey = reservationStorageKey(eventId, sectionId, quantity);
        let reservation = readStoredReservation(storageKey);
        if (!reservation || reservation.seatDocIds.length !== quantity || reservation.seatLabels.length !== quantity) {
            const expiredReservation = (() => {
                try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) { return null; }
            })();
            sessionStorage.removeItem(storageKey);
            if (expiredReservation?.seatDocIds?.length) {
                window.tsSeats.releaseSeats(expiredReservation.seatDocIds, { eventId }).catch(() => {});
            }

            const allocated = await window.tsSeats.reserveNextAvailableSeats({
                eventId,
                venueId: event.venueId,
                sectionId,
                count: quantity,
                expiryMinutes: 10
            });
            reservation = {
                seatDocIds: allocated.seats.map(seat => seat.id),
                seatLabels: allocated.seats.map(seat => seat.seatLabel),
                reservationExpiry: allocated.reservationExpiry,
                reservationId: allocated.reservationId || ''
            };
            sessionStorage.setItem(storageKey, JSON.stringify(reservation));
        }

        assignedText.textContent = `${category.name} · Seats: ${reservation.seatLabels.join(', ')}`;
        assignedSubtext.textContent = 'These seats are reserved while you complete checkout.';
        seatContainer.innerHTML = reservation.seatLabels
            .map(label => `<span class="ts-seat-pill next">${escapeHtml(label)}</span>`)
            .join('');

        const checkoutParams = new URLSearchParams({
            eventId,
            sectionId,
            qty: String(reservation.seatDocIds.length),
            seatIds: reservation.seatDocIds.join(','),
            seatLabels: reservation.seatLabels.join(','),
            reservationExpiry: reservation.reservationExpiry
        });
        if (reservation.reservationId) checkoutParams.set('reservationId', reservation.reservationId);
        const checkoutUrl = `checkout.php?${checkoutParams.toString()}`;

        const profile = window.tsCurrentUser || {};
        const walletName = document.getElementById('wallet-name');
        const walletStatus = document.getElementById('wallet-status');
        const walletChip = document.getElementById('wallet-chip');
        if (profile.walletAddress) {
            walletName.textContent = 'Wallet Connected';
            walletStatus.textContent = profile.walletAddress;
            walletChip.className = 'ts-chip ts-chip-success';
            walletChip.textContent = 'Ready';
            enableContinue('Continue to Payment', checkoutUrl);
        } else {
            walletName.textContent = 'Wallet Required';
            walletStatus.textContent = 'Connect a wallet to continue checkout.';
            walletChip.className = 'ts-chip ts-chip-warning';
            walletChip.textContent = 'Required';
            enableContinue('Continue to Wallet', `wallet.php?redirect=${encodeURIComponent(checkoutUrl)}`);
        }

        reservationBar.style.display = 'flex';
        let released = false;
        const expireReservation = async () => {
            if (released) return;
            released = true;
            sessionStorage.removeItem(storageKey);
            disableContinue('Reservation Expired');
            assignedSubtext.textContent = 'Your reserved seats were released. Choose a category to try again.';
            try {
                await window.tsSeats.releaseSeats(reservation.seatDocIds, { eventId });
            } catch (error) {
                console.warn('Could not release the expired reservation:', error);
            }
        };
        const updateCountdown = () => {
            const remainingSeconds = Math.max(0, Math.ceil((Date.parse(reservation.reservationExpiry) - Date.now()) / 1000));
            countdown.textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
            if (remainingSeconds <= 0) {
                clearInterval(timer);
                expireReservation();
            }
        };
        const timer = setInterval(updateCountdown, 1000);
        updateCountdown();
    } catch (error) {
        console.error('Seat assignment failed:', error);
        assignedText.textContent = 'Seats could not be reserved';
        assignedSubtext.textContent = error.message || 'Please return to category selection and try again.';
        seatContainer.innerHTML = '';
        reservationBar.style.display = 'none';
        disableContinue('Choose a Category');
    }
};

window.addEventListener('ts-auth-ready', event => {
    if (event.detail) initializeSeatAssignment();
});
if (window.tsCurrentUser) initializeSeatAssignment();
</script>

<?php
$content = ob_get_clean();
render_public_page('Seat Assignment', 'events', $content, '..', true);
?>
