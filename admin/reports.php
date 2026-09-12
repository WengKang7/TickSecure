<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?= ts_page_head(
    'Sales Report',
    'Review confirmed ticket bookings, completed resales and ticket entry activity across the platform.',
    '<button id="btn-export-sales" class="ts-btn ts-btn-secondary" type="button">'.ts_icon('download').' Export CSV</button>'
) ?>

<div class="ts-card ts-card-pad">
    <div class="flex justify-between items-start gap-12" style="flex-wrap:wrap">
        <div>
            <div class="ts-card-title">Report filters</div>
            <div class="ts-card-sub">Amounts are recorded simulated-payment data for this FYP build, not real payment settlement.</div>
        </div>
        <div id="sales-report-status" class="small secondary" aria-live="polite">Loading sales data&hellip;</div>
    </div>
    <div class="ts-form-grid mt-20">
        <div class="ts-field">
            <label class="ts-label" for="sales-date-from">Date from</label>
            <input id="sales-date-from" class="ts-input" type="date">
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-date-to">Date to</label>
            <input id="sales-date-to" class="ts-input" type="date">
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-event-filter">Event</label>
            <select id="sales-event-filter" class="ts-select">
                <option value="">All events</option>
            </select>
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-source-filter">Sale source</label>
            <select id="sales-source-filter" class="ts-select">
                <option value="">All recorded sales</option>
                <option value="primary">Primary ticket sales</option>
                <option value="resale">Resale sales</option>
            </select>
        </div>
    </div>
    <div class="flex justify-end gap-12 mt-24" style="flex-wrap:wrap">
        <button id="btn-reset-sales-filters" class="ts-btn ts-btn-secondary" type="button">Reset</button>
        <button id="btn-apply-sales-filters" class="ts-btn ts-btn-primary" type="button">Apply filters</button>
    </div>
</div>

<div class="ts-kpi-grid mt-24">
    <?= ts_kpi('Recorded checkout total', '<span id="sales-kpi-primary">RM0.00</span>', 'chart') ?>
    <?= ts_kpi('Tickets issued', '<span id="sales-kpi-tickets">0</span>', 'ticket') ?>
    <?= ts_kpi('Service charges', '<span id="sales-kpi-fees">RM0.00</span>', 'file') ?>
    <?= ts_kpi('Resale volume', '<span id="sales-kpi-resale">RM0.00</span>', 'activity') ?>
</div>

<div class="ts-grid-2 mt-24">
    <section class="ts-card">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Sales activity over time</div>
                <div id="sales-trend-subtitle" class="ts-card-sub">Confirmed bookings and completed resales by recorded date.</div>
            </div>
        </div>
        <div class="ts-chart">
            <div class="ts-chart-grid" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <div id="sales-trend-bars" class="ts-bars" aria-label="Sales activity chart"></div>
        </div>
        <div id="sales-trend-labels" class="flex justify-between small secondary" style="gap:8px;padding:0 22px 14px;"></div>
    </section>
    <section class="ts-card ts-card-pad">
        <div class="ts-card-title">Report composition</div>
        <div class="ts-card-sub">Primary and secondary activity kept separate for clear reporting.</div>
        <div class="ts-summary-row mt-20"><span>Ticket face value</span><strong id="sales-face-value">RM0.00</strong></div>
        <div class="ts-summary-row"><span>Recorded checkout total</span><strong id="sales-primary-detail">RM0.00</strong></div>
        <div class="ts-summary-row"><span>Completed resale volume</span><strong id="sales-resale-detail">RM0.00</strong></div>
        <div class="ts-summary-row"><span>Total sales activity</span><strong id="sales-total-detail">RM0.00</strong></div>
        <div class="ts-summary-row"><span>Checked-in tickets</span><strong id="sales-checkins-detail">0</strong></div>
        <div class="ts-summary-row"><span>Sales records included</span><strong id="sales-records-detail">0</strong></div>
    </section>
</div>

<section class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Event performance</div>
            <div class="ts-card-sub">Primary sales and resales follow every filter; entry scans follow the selected event and date range.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Confirmed bookings</th>
                    <th>Tickets</th>
                    <th>Checkout total</th>
                    <th>Sold resales</th>
                    <th>Resale volume</th>
                    <th>Checked in</th>
                </tr>
            </thead>
            <tbody id="sales-event-table-body">
                <tr><td colspan="7" class="secondary">Loading report data&hellip;</td></tr>
            </tbody>
        </table>
    </div>
</section>

<section class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Recorded sales</div>
            <div class="ts-card-sub">Only confirmed primary bookings and completed resale listings are included.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Source</th>
                    <th>Recorded</th>
                    <th>Event / category</th>
                    <th>Buyer / seller</th>
                    <th>Tickets</th>
                    <th>Amount</th>
                    <th>State</th>
                </tr>
            </thead>
            <tbody id="sales-transaction-table-body">
                <tr><td colspan="7" class="secondary">Loading report data&hellip;</td></tr>
            </tbody>
        </table>
    </div>
</section>

<script type="module">
const el = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character]));
const amount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const integer = (value) => Math.max(0, Math.round(amount(value)));
const currency = new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', minimumFractionDigits: 2, maximumFractionDigits: 2
});
const number = new Intl.NumberFormat('en-MY');
const displayDate = new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur'
});
const displayDay = new Intl.DateTimeFormat('en-MY', {
    day: '2-digit', month: 'short', timeZone: 'Asia/Kuala_Lumpur'
});
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kuala_Lumpur'
});

let bookings = [];
let resaleListings = [];
let tickets = [];
let events = [];
let eventById = new Map();
let lastReport = { transactions: [] };

function dateFromValue(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateToValue(value) {
    if (!value) return null;
    const date = new Date(`${value}T23:59:59.999+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function asDate(value) {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        const converted = value.toDate();
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
}

function normalise(value) {
    return String(value || '').trim().toUpperCase();
}

function eventDetails(record) {
    const eventId = String(record.eventId || '').trim();
    const event = eventById.get(eventId);
    return {
        id: eventId,
        name: String(record.eventName || event?.name || event?.title || 'Event not recorded').trim() || 'Event not recorded'
    };
}

function selectedBounds() {
    return {
        from: dateFromValue(el('#sales-date-from').value),
        to: dateToValue(el('#sales-date-to').value)
    };
}

function matchesScope(record, timestamp) {
    const selectedEventId = el('#sales-event-filter').value;
    if (selectedEventId && String(record.eventId || '') !== selectedEventId) return false;

    const { from, to } = selectedBounds();
    if (!from && !to) return true;
    const recordedAt = asDate(timestamp);
    if (!recordedAt) return false;
    if (from && recordedAt < from) return false;
    if (to && recordedAt > to) return false;
    return true;
}

function eventBucket(buckets, record) {
    const details = eventDetails(record);
    const key = details.id || `unlinked:${details.name}`;
    if (!buckets.has(key)) {
        buckets.set(key, {
            name: details.name,
            confirmedBookings: 0,
            tickets: 0,
            checkoutTotal: 0,
            resaleCount: 0,
            resaleVolume: 0,
            checkedIn: 0
        });
    }
    return buckets.get(key);
}

function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="secondary">${escapeHtml(message)}</td></tr>`;
}

function renderTrend(transactions) {
    const grouped = new Map();
    transactions.forEach((transaction) => {
        const recordedAt = asDate(transaction.recordedAt);
        if (!recordedAt) return;
        const key = dayKeyFormatter.format(recordedAt);
        grouped.set(key, (grouped.get(key) || 0) + transaction.amount);
    });

    const trend = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
    const bars = el('#sales-trend-bars');
    const labels = el('#sales-trend-labels');
    if (!trend.length) {
        bars.innerHTML = '<div class="secondary small" style="width:100%;text-align:center;padding-bottom:72px;">No recorded sales in this scope.</div>';
        labels.innerHTML = '';
        return;
    }

    const maximum = Math.max(...trend.map(([, value]) => value), 1);
    bars.innerHTML = trend.map(([key, value]) => {
        const height = Math.max(12, Math.round((value / maximum) * 100));
        return `<span class="ts-bar" style="height:${height}%" title="${escapeHtml(`${key}: ${currency.format(value)}`)}"></span>`;
    }).join('');
    labels.innerHTML = trend.map(([key]) => {
        const date = new Date(`${key}T12:00:00+08:00`);
        return `<span>${escapeHtml(displayDay.format(date))}</span>`;
    }).join('');
}

function renderEventTable(buckets) {
    const rows = [...buckets.values()].sort((a, b) => (
        (b.checkoutTotal + b.resaleVolume) - (a.checkoutTotal + a.resaleVolume)
    ));
    el('#sales-event-table-body').innerHTML = rows.length ? rows.map((row) => `
        <tr>
            <td><div class="cell-title">${escapeHtml(row.name)}</div></td>
            <td>${number.format(row.confirmedBookings)}</td>
            <td>${number.format(row.tickets)}</td>
            <td>${escapeHtml(currency.format(row.checkoutTotal))}</td>
            <td>${number.format(row.resaleCount)}</td>
            <td>${escapeHtml(currency.format(row.resaleVolume))}</td>
            <td>${number.format(row.checkedIn)}</td>
        </tr>
    `).join('') : emptyRow(7, 'No event activity matches the selected filters.');
}

function renderTransactionTable(transactions) {
    el('#sales-transaction-table-body').innerHTML = transactions.length ? transactions.map((transaction) => `
        <tr>
            <td><div class="cell-title">${escapeHtml(transaction.source)}</div><div class="cell-sub">${escapeHtml(transaction.id)}</div></td>
            <td>${escapeHtml(formatRecordedAt(transaction.recordedAt))}</td>
            <td><div class="cell-title">${escapeHtml(transaction.eventName)}</div><div class="cell-sub">${escapeHtml(transaction.categoryName || 'Category not recorded')}</div></td>
            <td>${escapeHtml(transaction.party)}</td>
            <td>${number.format(transaction.tickets)}</td>
            <td>${escapeHtml(currency.format(transaction.amount))}</td>
            <td><span class="ts-chip ts-chip-success">${escapeHtml(transaction.state)}</span><div class="cell-sub">${escapeHtml(transaction.paymentState)}</div></td>
        </tr>
    `).join('') : emptyRow(7, 'No confirmed bookings or completed resales match the selected filters.');
}

function formatRecordedAt(value) {
    const date = asDate(value);
    return date ? displayDate.format(date) : 'Not recorded';
}

function applyReport() {
    const source = el('#sales-source-filter').value;
    const buckets = new Map();
    const transactions = [];

    const confirmedBookings = source === 'resale' ? [] : bookings.filter((booking) => (
        normalise(booking.status) === 'CONFIRMED' && matchesScope(booking, booking.createdAt || booking.updatedAt)
    ));
    const soldResales = source === 'primary' ? [] : resaleListings.filter((listing) => (
        normalise(listing.status) === 'SOLD' && matchesScope(listing, listing.completedAt || listing.updatedAt || listing.createdAt)
    ));
    const checkedInTickets = tickets.filter((ticket) => (
        normalise(ticket.status) === 'USED' && matchesScope(ticket, ticket.usedAt || ticket.updatedAt || ticket.createdAt)
    ));

    let checkoutTotal = 0;
    let ticketFaceValue = 0;
    let ticketQuantity = 0;
    let serviceCharges = 0;
    let resaleVolume = 0;

    confirmedBookings.forEach((booking) => {
        const quantity = integer(booking.quantity || booking.seats?.length);
        const total = amount(booking.totalAmount);
        const unitPrice = amount(booking.unitPrice);
        const fees = amount(booking.serviceCharge);
        const details = eventDetails(booking);
        const bucket = eventBucket(buckets, booking);
        bucket.confirmedBookings += 1;
        bucket.tickets += quantity;
        bucket.checkoutTotal += total;

        checkoutTotal += total;
        ticketFaceValue += unitPrice * quantity;
        ticketQuantity += quantity;
        serviceCharges += fees;
        transactions.push({
            id: booking.id || 'Booking',
            source: 'Primary sale',
            recordedAt: booking.createdAt || booking.updatedAt || '',
            eventName: details.name,
            categoryName: booking.categoryName || booking.sectionId || '',
            party: booking.buyerName || booking.buyerEmail || booking.buyerUid || 'Buyer not recorded',
            tickets: quantity,
            amount: total,
            state: 'CONFIRMED',
            paymentState: booking.paymentStatus || 'SIMULATED_PAID'
        });
    });

    soldResales.forEach((listing) => {
        const details = eventDetails(listing);
        const total = amount(listing.resalePrice);
        const bucket = eventBucket(buckets, listing);
        bucket.resaleCount += 1;
        bucket.resaleVolume += total;

        resaleVolume += total;
        const seller = listing.sellerName || listing.sellerEmail || listing.sellerUid || 'Seller not recorded';
        const buyer = listing.buyerName || listing.buyerEmail || listing.buyerUid || '';
        transactions.push({
            id: listing.id || 'Resale listing',
            source: 'Resale sale',
            recordedAt: listing.completedAt || listing.updatedAt || listing.createdAt || '',
            eventName: details.name,
            categoryName: listing.categoryName || listing.sectionId || '',
            party: buyer ? `${seller} → ${buyer}` : seller,
            tickets: 1,
            amount: total,
            state: 'SOLD',
            paymentState: listing.paymentStatus || 'SIMULATED_PAID'
        });
    });

    checkedInTickets.forEach((ticket) => {
        eventBucket(buckets, ticket).checkedIn += 1;
    });

    transactions.sort((a, b) => {
        const timeB = asDate(b.recordedAt)?.getTime() || 0;
        const timeA = asDate(a.recordedAt)?.getTime() || 0;
        return timeB - timeA;
    });

    el('#sales-kpi-primary').textContent = currency.format(checkoutTotal);
    el('#sales-kpi-tickets').textContent = number.format(ticketQuantity);
    el('#sales-kpi-fees').textContent = currency.format(serviceCharges);
    el('#sales-kpi-resale').textContent = currency.format(resaleVolume);
    el('#sales-face-value').textContent = currency.format(ticketFaceValue);
    el('#sales-primary-detail').textContent = currency.format(checkoutTotal);
    el('#sales-resale-detail').textContent = currency.format(resaleVolume);
    el('#sales-total-detail').textContent = currency.format(checkoutTotal + resaleVolume);
    el('#sales-checkins-detail').textContent = number.format(checkedInTickets.length);
    el('#sales-records-detail').textContent = number.format(transactions.length);
    el('#sales-trend-subtitle').textContent = `${number.format(transactions.length)} recorded sale${transactions.length === 1 ? '' : 's'} in the selected scope.`;

    renderTrend(transactions);
    renderEventTable(buckets);
    renderTransactionTable(transactions);
    lastReport = { transactions };
}

function populateEventFilter() {
    const select = el('#sales-event-filter');
    const currentValue = select.value;
    const eventIds = new Set(events.map((event) => String(event.id)));
    const options = [...events]
        .sort((a, b) => String(a.name || a.title || '').localeCompare(String(b.name || b.title || '')))
        .map((event) => {
            const label = event.name || event.title || event.id;
            return `<option value="${escapeHtml(event.id)}">${escapeHtml(label)}</option>`;
    });
    select.innerHTML = `<option value="">All events</option>${options.join('')}`;
    select.value = eventIds.has(currentValue) ? currentValue : '';
}

function resetFilters() {
    el('#sales-date-from').value = '';
    el('#sales-date-to').value = '';
    el('#sales-event-filter').value = '';
    el('#sales-source-filter').value = '';
    applyReport();
}

function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportCsv() {
    const rows = [
        ['TickSecure Sales Report'],
        ['Generated (UTC)', new Date().toISOString()],
        ['Financial note', 'Recorded simulated-payment data only; not real payment settlement.'],
        [],
        ['Source', 'Recorded', 'Event', 'Category', 'Buyer / seller', 'Tickets', 'Amount (RM)', 'State', 'Payment marker'],
        ...lastReport.transactions.map((transaction) => [
            transaction.source,
            transaction.recordedAt || '',
            transaction.eventName,
            transaction.categoryName,
            transaction.party,
            transaction.tickets,
            amount(transaction.amount).toFixed(2),
            transaction.state,
            transaction.paymentState
        ])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticksecure-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function bindControls() {
    el('#btn-apply-sales-filters').addEventListener('click', applyReport);
    el('#btn-reset-sales-filters').addEventListener('click', resetFilters);
    el('#btn-export-sales').addEventListener('click', exportCsv);
}

window.addEventListener('ts-auth-ready', async () => {
    bindControls();
    try {
        [bookings, resaleListings, tickets, events] = await Promise.all([
            window.tsBookings.getBookings(),
            window.tsResale.getListings(),
            window.tsTickets.getTickets(),
            window.tsEvents.getEvents()
        ]);
        eventById = new Map(events.map((event) => [String(event.id), event]));
        populateEventFilter();
        applyReport();
        el('#sales-report-status').textContent = 'Live Firebase data loaded. Amounts are simulated payment records.';
    } catch (error) {
        console.error('Unable to load the sales report:', error);
        applyReport();
        el('#sales-report-status').textContent = 'Could not load sales data. Confirm you are signed in with an active, verified administrator account.';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Sales Report', 'reports', $content, '..', 'Administrator');
?>
