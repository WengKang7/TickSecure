<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Attendee Management', 'View booking, ticket and event-entry verification status for your events.', '<select class="ts-select"><option>Aurora After Dark</option></select>')?>
<div class="ts-grid-2 mb-24">
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Verified Attendees</span><span
                class="ts-kpi-icon"><?=ts_icon('check')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-verified">0</div>
        <div class="ts-kpi-label">Entry verified</div>
    </div>
    <div class="ts-card ts-kpi">
        <div class="ts-kpi-top"><span>Unverified Attendees</span><span
                class="ts-kpi-icon"><?=ts_icon('users')?></span>
        </div>
        <div class="ts-kpi-value" id="kpi-unverified">0</div>
        <div class="ts-kpi-label">Not yet scanned</div>
    </div>
</div>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Buyer, booking, ticket or wallet"></div><select class="ts-select">
            <option>All categories</option>
        </select><select class="ts-select">
            <option>All entry status</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Buyer</th>
                    <th>Booking</th>
                    <th>Ticket</th>
                    <th>Category</th>
                    <th>Seat</th>
                    <th>Wallet</th>
                    <th>Entry Status</th>
                </tr>
            </thead>
            <tbody id="attendees-tbody">
                <tr><td colspan="7" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const [bookings, tickets] = await Promise.all([
            window.tsBookings.getBookings(),
            window.tsTickets.getTickets()
        ]);
        const bookingById = new Map(bookings.map(booking => [booking.id, booking]));
        const attendees = tickets.map(ticket => {
            const booking = bookingById.get(ticket.bookingId);
            return {
                buyer: booking?.buyerName || booking?.buyerUid || 'Unknown',
                bookingId: ticket.bookingId || '—',
                ticketId: ticket.id,
                category: ticket.categoryName || ticket.category || 'N/A',
                seat: ticket.seatId || ticket.seat || 'N/A',
                wallet: ticket.walletAddress || ticket.ownerWallet || '—',
                verified: ticket.status === 'USED'
            };
        });

        const verifiedCount = attendees.filter(a => a.verified).length;
        const unverifiedCount = attendees.length - verifiedCount;

        document.getElementById('kpi-verified').textContent = verifiedCount.toLocaleString();
        document.getElementById('kpi-unverified').textContent = unverifiedCount.toLocaleString();

        const tbody = document.getElementById('attendees-tbody');
        if (tbody) {
            tbody.innerHTML = attendees.slice(0,20).map(a => `
                <tr>
                    <td class="cell-title">${esc(a.buyer)}</td>
                    <td>${esc(a.bookingId)}</td>
                    <td>${esc(a.ticketId)}</td>
                    <td>${esc(a.category)}</td>
                    <td>${esc(a.seat)}</td>
                    <td class="ts-wallet-id">${esc(a.wallet)}</td>
                    <td><span class="ts-chip ts-chip-${a.verified ? 'success' : 'neutral'}">${a.verified ? 'Verified' : 'Unverified'}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="7" class="text-center">No attendees found.</td></tr>';
        }

    } catch (e) {
        console.error('Failed to load attendees', e);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Attendees', 'attendees', $content, '..', '');
?>
