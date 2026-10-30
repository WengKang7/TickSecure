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
          <h1 class="mt-0 mb-8" id="rd-event-name">Loading…</h1>
          <p class="secondary" id="rd-ticket-info">Loading…</p>
        </div>
        <span class="ts-chip ts-chip-neutral" id="rd-status-badge">Loading…</span>
      </div>
      <div class="ts-divider"></div>
      <div class="ts-grid-3">
        <div><div class="ts-detail-label">Original price</div><div class="ts-kpi-value" style="font-size:22px" id="rd-orig-price">-</div></div>
        <div><div class="ts-detail-label">Resale price</div><div class="ts-kpi-value" style="font-size:22px" id="rd-resale-price">-</div></div>
        <div><div class="ts-detail-label">Maximum allowed</div><div class="ts-kpi-value" style="font-size:22px" id="rd-max-price">-</div></div>
      </div>
      <div class="ts-alert ts-alert-info mt-24" id="rd-rule-alert"><?=ts_icon('shield')?><div><strong id="rd-rule-title">Checking resale rules</strong><div class="small mt-8" id="rd-rule-copy">Loading the organizer-defined price and availability rules.</div></div></div>
    </div>
    <div class="ts-card ts-card-pad mt-20">
      <div class="ts-card-title">Ownership &amp; ticket information</div>
      <div class="ts-detail-grid mt-8">
        <div class="ts-detail-item"><div class="ts-detail-label">Seller</div><div class="ts-detail-value" id="rd-seller">Loading…</div></div>
        <div class="ts-detail-item"><div class="ts-detail-label">Ticket status</div><div class="ts-detail-value" id="rd-ticket-status">Loading…</div></div>
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
      <button class="ts-btn ts-btn-primary w-full mt-16" id="rd-purchase-btn" type="button" disabled>Loading…</button>
      <p class="small muted text-center" id="rd-purchase-message" aria-live="polite">A service charge of RM20.00 is included at checkout.</p>
      <p class="small muted text-center">This development checkout records a simulated payment; connect a verified payment provider before production.</p>
    </div>
  </aside>
</div></div></main>

<script type="module">
import '../assets/js/resale-policy.js';
const resaleServiceCharge = 20;

const amount = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const currency = value => `RM${amount(value).toFixed(2)}`;

const abbreviated = value => {
    const text = String(value || '');
    if (!text) return 'Not available';
    return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
};

const eventDateLabel = event => {
    const parts = [event?.date, event?.time].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Not available';
};

let resaleInitialized = false;
async function initializeResaleDetail() {
    if (resaleInitialized || !window.tsCurrentUser?.uid) return;
    resaleInitialized = true;
    const listingId = new URLSearchParams(window.location.search).get('id');
    const purchaseButton = document.getElementById('rd-purchase-btn');
    const purchaseMessage = document.getElementById('rd-purchase-message');

    if (!listingId) {
        document.getElementById('rd-event-name').textContent = 'Listing not found';
        purchaseMessage.textContent = 'A resale listing ID is required.';
        return;
    }

    try {
        if (!window.tsResale || !window.tsEvents) {
            throw new Error('Marketplace services are still loading. Please refresh and try again.');
        }

        const listing = await window.tsResale.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');

        let event = null;
        try {
            event = await window.tsEvents.getEvent(listing.eventId);
        } catch (error) {
            // Listings retain public event snapshots, so a listing can still
            // be shown if the event document is no longer readable.
            console.warn('Unable to load event details for resale listing:', error);
        }

        const status = String(listing.status || '').toUpperCase();
        const resalePrice = amount(listing.resalePrice);
        const maximumPrice = amount(listing.maxAllowedPrice);
        const unavailableReason = window.tsResalePolicy.unavailable(event);
        const currentMaximum = event ? window.tsResalePolicy.limits(event, listing).maximum : maximumPrice;
        const compliant = String(listing.ruleCompliance || '').toUpperCase() !== 'VIOLATION'
            && (!maximumPrice || resalePrice <= maximumPrice) && resalePrice <= currentMaximum;
        const available = status === 'ACTIVE' && compliant && !unavailableReason && resalePrice <= currentMaximum;
        const statusTone = {
            ACTIVE: 'success',
            SOLD: 'info',
            SUSPENDED: 'error',
            CANCELLED: 'neutral'
        }[status] || 'neutral';

        const statusBadge = document.getElementById('rd-status-badge');
        statusBadge.className = `ts-chip ts-chip-${statusTone}`;
        statusBadge.textContent = status || 'UNKNOWN';
        document.getElementById('rd-ticket-status').textContent = status === 'ACTIVE'
            ? 'Listed for resale'
            : (status || 'Unknown');
        document.getElementById('rd-event-name').textContent = listing.eventName || event?.name || 'Untitled event';
        document.getElementById('rd-ticket-info').textContent = `${listing.categoryName || 'Ticket'} · Seat ${listing.seatId || 'Not assigned'}`;
        document.getElementById('rd-orig-price').textContent = currency(listing.originalPrice);
        document.getElementById('rd-resale-price').textContent = currency(resalePrice);
        document.getElementById('rd-max-price').textContent = currentMaximum ? currency(currentMaximum) : 'Not configured';
        document.getElementById('rd-seller').textContent = abbreviated(listing.sellerWallet || listing.sellerUid);
        document.getElementById('rd-event-date').textContent = eventDateLabel(event);
        document.getElementById('rd-venue').textContent = event?.venueName || 'Not available';
        document.getElementById('rd-sum-ticket').textContent = currency(resalePrice);
        document.getElementById('rd-sum-total').textContent = currency(resalePrice + resaleServiceCharge);

        const ruleAlert = document.getElementById('rd-rule-alert');
        const ruleTitle = document.getElementById('rd-rule-title');
        const ruleCopy = document.getElementById('rd-rule-copy');
        ruleAlert.className = `ts-alert ${available ? 'ts-alert-success' : 'ts-alert-warning'} mt-24`;
        ruleTitle.textContent = available ? 'Resale available' : status === 'SOLD' ? 'Sale completed' : 'Listing unavailable';
        ruleCopy.textContent = available
            ? 'This listing is within the organizer-defined resale price and availability rules.'
            : status === 'SOLD' ? 'This ticket has already been purchased.'
                : (unavailableReason || listing.riskFlag || 'This listing is outside its permitted resale conditions.');

        const profile = window.tsCurrentUser;
        if (status === 'SOLD' && listing.buyerUid === profile?.uid) {
            purchaseButton.textContent = 'View purchased ticket';
            purchaseButton.disabled = false;
            purchaseMessage.textContent = `Purchase complete. Total ${currency(resalePrice + resaleServiceCharge)}.`;
            purchaseButton.addEventListener('click', () => { window.location.href = `../buyer/ticket-detail.php?id=${encodeURIComponent(listing.ticketId)}`; });
            return;
        }
        if (!profile) {
            purchaseButton.disabled = false;
            purchaseButton.textContent = 'Sign in to purchase';
            purchaseMessage.textContent = 'Sign in with an active buyer account to purchase this ticket.';
            purchaseButton.addEventListener('click', () => { window.location.href = '../auth/login.php'; });
            return;
        }

        if (profile.role !== 'buyer' || profile.status !== 'active') {
            purchaseButton.textContent = 'Buyer account required';
            purchaseMessage.textContent = 'Only active buyer accounts can purchase resale tickets.';
            return;
        }

        if (listing.sellerUid === profile.uid) {
            purchaseButton.textContent = 'You own this listing';
            purchaseMessage.textContent = 'A seller cannot purchase their own resale listing.';
            return;
        }

        if (!available) {
            purchaseButton.textContent = 'Listing unavailable';
            purchaseMessage.textContent = unavailableReason || listing.riskFlag || 'This listing is no longer available within the current price rules.';
            return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(profile.walletAddress || '')) {
            purchaseButton.textContent = 'Connect wallet to purchase';
            purchaseButton.disabled = false;
            purchaseMessage.textContent = 'A connected wallet is required to receive your ticket.';
            purchaseButton.addEventListener('click', () => {
                window.location.href = `../buyer/wallet.php?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            });
            return;
        }

        purchaseButton.disabled = false;
        purchaseButton.textContent = `Purchase for ${currency(resalePrice + resaleServiceCharge)}`;
        purchaseMessage.textContent = 'The secure resale service will re-check availability before completing the purchase.';
        purchaseButton.addEventListener('click', async () => {
            if (!window.tsResale?.purchaseListing) {
                purchaseMessage.textContent = 'Secure resale checkout is not available yet. Please try again shortly.';
                return;
            }

            if (purchaseButton.disabled) return;
            purchaseButton.disabled = true;
            if (!await window.tsDecision('purchaseResale', listing.eventName || event?.name || 'Resale ticket',
                [['Ticket price', currency(resalePrice)], ['Service charge', currency(resaleServiceCharge)],
                    ['Total', currency(resalePrice + resaleServiceCharge)], ['Receiving wallet', profile.walletAddress]])) {
                purchaseButton.disabled = false;
                return;
            }

            purchaseButton.disabled = true;
            purchaseButton.textContent = 'Completing purchase…';
            purchaseMessage.textContent = 'Checking availability and transferring the ticket…';
            try {
                const result = await window.tsResale.purchaseListing(listing.id, resalePrice);
                const ticketId = result?.ticketId || listing.ticketId;
                window.location.href = result?.blockchainRecordId ? `../buyer/blockchain.php?recordId=${encodeURIComponent(result.blockchainRecordId)}` : `../buyer/tickets.php?resalePurchase=${encodeURIComponent(ticketId)}`;
            } catch (error) {
                console.error('Resale purchase failed:', error);
                purchaseButton.disabled = false;
                purchaseButton.textContent = `Purchase for ${currency(resalePrice + resaleServiceCharge)}`;
                purchaseMessage.textContent = error?.message || 'The purchase could not be completed. Please try again.';
            }
        });
    } catch (error) {
        console.error('Unable to load resale listing:', error);
        document.getElementById('rd-event-name').textContent = 'Listing unavailable';
        document.getElementById('rd-ticket-info').textContent = error?.message || 'This resale listing could not be loaded.';
        purchaseButton.textContent = 'Listing unavailable';
        purchaseMessage.textContent = 'Please return to the resale marketplace and choose another listing.';
    }
}
window.addEventListener('ts-auth-ready', initializeResaleDetail);
if (window.tsCurrentUser?.uid) initializeResaleDetail();
</script>

<?php
$content = ob_get_clean();
render_public_page('Resale Ticket', 'resale', $content, '..', false);
?>
