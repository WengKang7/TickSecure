<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1100px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow" id="val-eyebrow">Loading...</div>
                <h1 class="ts-section-title" id="val-event">Loading...</h1>
                <p class="ts-section-copy" id="val-date">Loading...</p>
            </div>
            <div id="val-status-head"></div>
        </div>
        <div class="ts-grid-2">
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Booking details</div>
                <div class="ts-detail-grid mt-8">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Category</div>
                        <div class="ts-detail-value" id="val-cat">...</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Assigned Seat</div>
                        <div class="ts-detail-value" id="val-seat">...</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Quantity</div>
                        <div class="ts-detail-value" id="val-qty">...</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Booking Status</div>
                        <div class="ts-detail-value" id="val-status">...</div>
                    </div>
                </div><a class="ts-btn ts-btn-primary w-full mt-20" href="#" id="btn-ticket" style="display:none">Open NFT Ticket</a>
            </div>
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Payment summary</div>
                <div class="ts-summary-row"><span>Subtotal</span><strong id="val-subtotal">...</strong></div>
                <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
                <div class="ts-summary-row total"><span>Total Paid</span><span id="val-total">...</span></div>
                <div class="ts-detail-item">
                    <div class="ts-detail-label">Payment status</div>
                    <div class="ts-detail-value" id="val-payment-status">
                        ...
                    </div>
                </div>
            </div>
        </div>
        <div class="ts-accordion mt-24"><button class="ts-accordion-trigger">Blockchain transaction associated with this
                booking <span
                    class="chev"><?=ts_icon('chevron-down')?></span></button>
            <div class="ts-accordion-panel">
                <div class="ts-detail-grid">
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Minting Status</div>
                        <div class="ts-detail-value" id="val-mint-status">
                            ...
                        </div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Transaction Hash</div>
                        <div class="ts-detail-value ts-copy-code" id="val-tx">...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    if (!bookingId) return;

    try {
        const booking = await window.tsBookings.getBooking(bookingId);
        
        document.getElementById('val-eyebrow').textContent = \`Booking \${booking.id}\`;
        document.getElementById('val-event').textContent = booking.eventName || 'Event';
        
        const dateStr = booking.createdAt ? (typeof booking.createdAt.toDate === 'function' ? booking.createdAt.toDate().toLocaleString() : booking.createdAt) : '';
        document.getElementById('val-date').textContent = \`Confirmed \${dateStr}\`;
        
        let tone = 'success';
        let status = 'Confirmed';
        if (booking.status === 'completed') { tone = 'neutral'; status = 'Completed'; }
        else if (booking.status === 'cancelled') { tone = 'error'; status = 'Cancelled'; }
        
        const statusHtml = \`<span class="ts-chip ts-chip-\${tone}">\${status}</span>\`;
        document.getElementById('val-status-head').innerHTML = statusHtml;
        document.getElementById('val-status').innerHTML = statusHtml;
        
        document.getElementById('val-cat').textContent = booking.category || 'N/A';
        document.getElementById('val-seat').textContent = booking.seat || (booking.seats || []).join(', ') || 'N/A';
        document.getElementById('val-qty').textContent = booking.qty || 1;
        
        const total = parseFloat(booking.totalAmount || 0);
        document.getElementById('val-subtotal').textContent = \`RM\${(total - 20).toFixed(2)}\`;
        document.getElementById('val-total').textContent = \`RM\${total.toFixed(2)}\`;
        document.getElementById('val-payment-status').innerHTML = \`<span class="ts-chip ts-chip-success">Successful</span>\`;
        
        if (booking.txHash) {
            document.getElementById('val-mint-status').innerHTML = '<span class="ts-chip ts-chip-success">Confirmed</span>';
            document.getElementById('val-tx').textContent = booking.txHash;
        } else {
            document.getElementById('val-mint-status').innerHTML = '<span class="ts-chip ts-chip-warning">Pending</span>';
            document.getElementById('val-tx').textContent = 'Pending mint...';
        }
        
        // If ticketId is associated, wire the Open Ticket button
        if (booking.ticketId) {
            const btn = document.getElementById('btn-ticket');
            btn.href = \`ticket-detail.php?id=\${booking.ticketId}\`;
            btn.style.display = 'block';
        }
        
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Booking Details', 'tickets', $content, '..', true);
?>