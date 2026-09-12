<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Account history</div>
                <h1 class="ts-section-title">Booking History</h1>
                <p class="ts-section-copy">Search current and previous ticket bookings, payments and related NFT
                    tickets.</p>
            </div>
        </div>
        <div class="ts-card">
            <div class="ts-filter-bar">
                <div class="ts-input-wrap ts-search">
                    <?=ts_icon('search')?><input
                        class="ts-input" placeholder="Booking number or event name"></div><select class="ts-select">
                    <option>Upcoming</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                    <option>Refunded</option>
                </select>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Booking</th>
                            <th>Event</th>
                            <th>Category / Seat</th>
                            <th>Booking Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="bookings-tbody">
                        <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading bookings...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="ts-pagination"><span id="bookings-count">0 bookings</span>
                <div class="ts-page-numbers"><span class="ts-page-num active">1</span></div>
            </div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    try {
        const bookings = await window.tsBookings.getUserBookings();
        const tbody = document.getElementById('bookings-tbody');
        document.getElementById('bookings-count').textContent = `${bookings.length} bookings`;
        
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No bookings found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = bookings.map(b => {
            const seats = (b.seats || []).join(', ') || 'N/A';
            const catSeat = `${b.categoryName || 'N/A'} · ${seats}`;
            let tone = 'success';
            let status = 'Confirmed';
            const bookingStatus = (b.status || '').toUpperCase();
            if (bookingStatus === 'COMPLETED') { tone = 'neutral'; status = 'Completed'; }
            else if (bookingStatus === 'CANCELLED') { tone = 'error'; status = 'Cancelled'; }
            
            const dateStr = b.createdAt ? (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().toLocaleDateString() : b.createdAt) : 'N/A';
            const amountStr = `RM${parseFloat(b.totalAmount || 0).toFixed(2)}`;
            
            return `
            <tr>
                <td class="cell-title">${b.bookingNumber || b.id}</td>
                <td>${b.eventName}</td>
                <td>${catSeat}</td>
                <td>${dateStr}</td>
                <td>${amountStr}</td>
                <td><span class="ts-chip ts-chip-${tone}">${status}</span></td>
                <td class="text-right"><a class="ts-btn ts-btn-secondary ts-btn-sm" href="booking-detail.php?id=${b.id}">View</a></td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Booking History', 'tickets', $content, '..', true);
?>
