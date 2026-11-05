<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?= ts_page_head(
    'Sales Report',
    'Review monthly and yearly sales across all organizers, with separate primary ticket sales and resale activity.',
    '<button id="btn-export-sales" class="ts-btn ts-btn-secondary" type="button" disabled>'.ts_icon('download').' Export CSV</button>'
) ?>

<div class="ts-card ts-card-pad">
    <div class="flex justify-between items-start gap-12" style="flex-wrap:wrap">
        <div>
            <div class="ts-card-title">Report filters</div>
            <div class="ts-card-sub">Amounts are recorded simulated-payment data for this FYP build, not real payment settlement.</div>
        </div>
        <div id="sales-report-status" class="small secondary" aria-live="polite">Loading sales data&hellip;</div>
    </div>
    <div class="ts-sales-report-filters mt-20">
        <div class="ts-field">
            <label class="ts-label" for="sales-year-filter">Year</label>
            <select id="sales-year-filter" class="ts-select"><option value="">All years</option></select>
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-month-filter">Month</label>
            <select id="sales-month-filter" class="ts-select">
                <option value="">All months</option>
                <option value="01">January</option><option value="02">February</option><option value="03">March</option>
                <option value="04">April</option><option value="05">May</option><option value="06">June</option>
                <option value="07">July</option><option value="08">August</option><option value="09">September</option>
                <option value="10">October</option><option value="11">November</option><option value="12">December</option>
            </select>
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-organizer-filter">Organizer</label>
            <select id="sales-organizer-filter" class="ts-select"><option value="">All organizers</option></select>
        </div>
        <div class="ts-field">
            <label class="ts-label" for="sales-group-filter">Report view</label>
            <select id="sales-group-filter" class="ts-select"><option value="month">Monthly totals</option><option value="year">Yearly totals</option></select>
        </div>
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
    <p class="small secondary mt-16">Month, year and date range filters use Malaysia time (UTC+8). Leave Organizer as “All organizers” for platform-wide sales.</p>
    <div class="flex justify-end gap-12 mt-24" style="flex-wrap:wrap">
        <button id="btn-reset-sales-filters" class="ts-btn ts-btn-secondary" type="button">Reset</button>
        <button id="btn-apply-sales-filters" class="ts-btn ts-btn-primary" type="button" disabled>Apply filters</button>
    </div>
</div>

<p id="sales-report-scope" class="secondary mt-24" aria-live="polite">All organizers · All years · All months</p>
<div class="ts-kpi-grid mt-16">
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
    <div class="ts-card-head"><div>
        <div class="ts-card-title" id="sales-period-title">Monthly sales</div>
        <div class="ts-card-sub">Every period with recorded activity is listed. Sales use the purchase date; entry activity uses the check-in date.</div>
    </div></div>
    <div class="ts-table-wrap"><table class="ts-table ts-sales-summary-table">
        <thead><tr><th>Period</th><th>Bookings</th><th>Tickets</th><th>Checkout total</th><th>Service charges</th><th>Resale volume</th><th>Total sales activity</th><th>Checked in</th></tr></thead>
        <tbody id="sales-period-table-body"><tr><td colspan="8" class="secondary">Loading report data&hellip;</td></tr></tbody>
    </table></div>
</section>

<section class="ts-card mt-24">
    <div class="ts-card-head"><div>
        <div class="ts-card-title">Sales by organizer</div>
        <div class="ts-card-sub">Organizers with activity in the selected period. Checkout totals include service charges; resale volume is secondary-market activity, not organizer income.</div>
    </div></div>
    <div class="ts-table-wrap"><table class="ts-table ts-sales-summary-table">
        <thead><tr><th>Organizer</th><th>Events</th><th>Bookings</th><th>Tickets</th><th>Checkout total</th><th>Resale volume</th><th>Total sales activity</th></tr></thead>
        <tbody id="sales-organizer-table-body"><tr><td colspan="7" class="secondary">Loading report data&hellip;</td></tr></tbody>
    </table></div>
</section>

<section class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Event performance</div>
            <div class="ts-card-sub">Primary sales and resales follow every filter. Entry scans follow the organizer, event and period filters.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Organizer</th>
                    <th>Confirmed bookings</th>
                    <th>Tickets</th>
                    <th>Checkout total</th>
                    <th>Sold resales</th>
                    <th>Resale volume</th>
                    <th>Checked in</th>
                </tr>
            </thead>
            <tbody id="sales-event-table-body">
                <tr><td colspan="8" class="secondary">Loading report data&hellip;</td></tr>
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
                    <th>Organizer</th>
                    <th>Buyer / seller</th>
                    <th>Tickets</th>
                    <th>Amount</th>
                    <th>State</th>
                </tr>
            </thead>
            <tbody id="sales-transaction-table-body">
                <tr><td colspan="8" class="secondary">Loading report data&hellip;</td></tr>
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
const displayMonth = new Intl.DateTimeFormat('en-MY', {
    month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur'
});
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kuala_Lumpur'
});

let bookings = [];
let resaleListings = [];
let tickets = [];
let events = [];
let eventById = new Map();
let organizerById = new Map();
let organizerOptions = new Map();
let reportLoaded = false;
let controlsBound = false;
let loadVersion = 0;
let lastReport = { transactions: [], periods: [], organizers: [], filters: {} };

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

function organizerDetails(record) {
    const event = eventById.get(String(record.eventId || ''));
    const id = String(event?.organizerUid || record.organizerUid || '').trim();
    const profile = organizerById.get(id);
    return {
        id, key: id || '__unassigned__',
        name: String(profile?.organizationName || profile?.fullName || event?.organizerName || record.organizerName || id || 'Organizer not recorded')
    };
}

function reportFilters() {
    return {
        year: el('#sales-year-filter').value,
        month: el('#sales-month-filter').value,
        organizer: el('#sales-organizer-filter').value,
        grouping: el('#sales-group-filter').value === 'year' ? 'year' : 'month',
        from: el('#sales-date-from').value, to: el('#sales-date-to').value,
        event: el('#sales-event-filter').value, source: el('#sales-source-filter').value
    };
}

function periodDetails(value) {
    const date = asDate(value);
    if (!date) return { key: 'undated', name: 'Date not recorded' };
    const day = dayKeyFormatter.format(date);
    if (el('#sales-group-filter').value === 'year') return { key: day.slice(0, 4), name: day.slice(0, 4) };
    const key = day.slice(0, 7);
    return { key, name: displayMonth.format(date) };
}

function emptyMetrics() {
    return { confirmedBookings: 0, tickets: 0, checkoutTotal: 0, serviceCharges: 0, resaleCount: 0, resaleVolume: 0, checkedIn: 0 };
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

    const organizer = el('#sales-organizer-filter').value;
    if (organizer && organizerDetails(record).key !== organizer) return false;
    const year = el('#sales-year-filter').value, month = el('#sales-month-filter').value;
    const { from, to } = selectedBounds();
    if (!from && !to && !year && !month) return true;
    const recordedAt = asDate(timestamp);
    if (!recordedAt) return false;
    const day = dayKeyFormatter.format(recordedAt);
    if (year && day.slice(0, 4) !== year) return false;
    if (month && day.slice(5, 7) !== month) return false;
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
            organizer: organizerDetails(record).name,
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

function renderTrend(periods) {
    // The complete period table remains available when the chart is abbreviated.
    const trend = [...periods].filter(row => row.key !== 'undated').reverse().slice(-12);
    const bars = el('#sales-trend-bars'), labels = el('#sales-trend-labels');
    if (!trend.length || !trend.some(row => row.checkoutTotal + row.resaleVolume > 0)) {
        bars.innerHTML = '<div class="secondary small" style="width:100%;text-align:center;padding-bottom:72px;">No dated sales in this scope.</div>';
        labels.innerHTML = '';
        return;
    }
    const maximum = Math.max(...trend.map(row => row.checkoutTotal + row.resaleVolume), 1);
    bars.innerHTML = trend.map(row => {
        const value = row.checkoutTotal + row.resaleVolume;
        return `<span class="ts-bar" style="height:${Math.max(0, Math.round(value / maximum * 100))}%;min-height:${value ? 4 : 0}px" title="${escapeHtml(`${row.name}: ${currency.format(value)}`)}"></span>`;
    }).join('');
    labels.innerHTML = trend.map(row => `<span>${escapeHtml(row.name)}</span>`).join('');
}

function renderPeriodTable(rows) {
    el('#sales-period-title').textContent = el('#sales-group-filter').value === 'year' ? 'Yearly sales' : 'Monthly sales';
    el('#sales-period-table-body').innerHTML = rows.length ? rows.map(row => `<tr>
        <td class="cell-title">${escapeHtml(row.name)}</td><td>${number.format(row.confirmedBookings)}</td>
        <td>${number.format(row.tickets)}</td><td>${escapeHtml(currency.format(row.checkoutTotal))}</td>
        <td>${escapeHtml(currency.format(row.serviceCharges))}</td><td>${escapeHtml(currency.format(row.resaleVolume))}</td>
        <td>${escapeHtml(currency.format(row.checkoutTotal + row.resaleVolume))}</td><td>${number.format(row.checkedIn)}</td>
    </tr>`).join('') : emptyRow(8, 'No activity matches the selected period and filters.');
}

function renderOrganizerTable(rows) {
    el('#sales-organizer-table-body').innerHTML = rows.length ? rows.map(row => `<tr>
        <td><div class="cell-title">${escapeHtml(row.name)}</div><div class="cell-sub">${escapeHtml(row.id || 'Unassigned records')}</div></td>
        <td>${number.format(row.events.size)}</td><td>${number.format(row.confirmedBookings)}</td><td>${number.format(row.tickets)}</td>
        <td>${escapeHtml(currency.format(row.checkoutTotal))}</td><td>${escapeHtml(currency.format(row.resaleVolume))}</td>
        <td>${escapeHtml(currency.format(row.checkoutTotal + row.resaleVolume))}</td>
    </tr>`).join('') : emptyRow(7, 'No organizer activity matches the selected filters.');
}

function renderEventTable(buckets) {
    const rows = [...buckets.values()].sort((a, b) => (
        (b.checkoutTotal + b.resaleVolume) - (a.checkoutTotal + a.resaleVolume)
    ));
    el('#sales-event-table-body').innerHTML = rows.length ? rows.map((row) => `
        <tr>
            <td><div class="cell-title">${escapeHtml(row.name)}</div></td>
            <td>${escapeHtml(row.organizer)}</td>
            <td>${number.format(row.confirmedBookings)}</td>
            <td>${number.format(row.tickets)}</td>
            <td>${escapeHtml(currency.format(row.checkoutTotal))}</td>
            <td>${number.format(row.resaleCount)}</td>
            <td>${escapeHtml(currency.format(row.resaleVolume))}</td>
            <td>${number.format(row.checkedIn)}</td>
        </tr>
    `).join('') : emptyRow(8, 'No event activity matches the selected filters.');
}

function renderTransactionTable(transactions) {
    el('#sales-transaction-table-body').innerHTML = transactions.length ? transactions.map((transaction) => `
        <tr>
            <td><div class="cell-title">${escapeHtml(transaction.source)}</div><div class="cell-sub">${escapeHtml(transaction.id)}</div></td>
            <td>${escapeHtml(formatRecordedAt(transaction.recordedAt))}</td>
            <td><div class="cell-title">${escapeHtml(transaction.eventName)}</div><div class="cell-sub">${escapeHtml(transaction.categoryName || 'Category not recorded')}</div></td>
            <td>${escapeHtml(transaction.organizerName)}</td>
            <td>${escapeHtml(transaction.party)}</td>
            <td>${number.format(transaction.tickets)}</td>
            <td>${escapeHtml(currency.format(transaction.amount))}</td>
            <td><span class="ts-chip ts-chip-success">${escapeHtml(transaction.state)}</span><div class="cell-sub">${escapeHtml(transaction.paymentState)}</div></td>
        </tr>
    `).join('') : emptyRow(8, 'No confirmed bookings or completed resales match the selected filters.');
}

function formatRecordedAt(value) {
    const date = asDate(value);
    return date ? displayDate.format(date) : 'Not recorded';
}

function applyReport() {
    if (!reportLoaded) return;
    const { from, to } = selectedBounds();
    if (from && to && from > to) {
        el('#sales-report-status').textContent = 'Date from must be on or before Date to. The previous report is still displayed.';
        return;
    }
    const source = el('#sales-source-filter').value;
    const buckets = new Map();
    const transactions = [];
    const periodBuckets = new Map(), organizerBuckets = new Map();
    function addActivity(record, recordedAt, metrics) {
        const period = periodDetails(recordedAt), organizer = organizerDetails(record);
        if (!periodBuckets.has(period.key)) periodBuckets.set(period.key, { ...emptyMetrics(), ...period });
        if (!organizerBuckets.has(organizer.key)) organizerBuckets.set(organizer.key, { ...emptyMetrics(), ...organizer, events: new Set() });
        const organizerRow = organizerBuckets.get(organizer.key);
        if (record.eventId) organizerRow.events.add(String(record.eventId));
        for (const [key, value] of Object.entries(metrics)) {
            periodBuckets.get(period.key)[key] += value;
            organizerRow[key] += value;
        }
    }

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
        addActivity(booking, booking.createdAt || booking.updatedAt, { confirmedBookings: 1, tickets: quantity, checkoutTotal: total, serviceCharges: fees });
        transactions.push({
            organizerId: organizerDetails(booking).id,
            organizerName: organizerDetails(booking).name,
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
        addActivity(listing, listing.completedAt || listing.updatedAt || listing.createdAt, { resaleCount: 1, resaleVolume: total });
        const seller = listing.sellerName || listing.sellerEmail || listing.sellerUid || 'Seller not recorded';
        const buyer = listing.buyerName || listing.buyerEmail || listing.buyerUid || '';
        transactions.push({
            organizerId: organizerDetails(listing).id,
            organizerName: organizerDetails(listing).name,
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
        addActivity(ticket, ticket.usedAt || ticket.updatedAt || ticket.createdAt, { checkedIn: 1 });
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
    const periods = [...periodBuckets.values()].sort((a, b) => a.key === 'undated' ? 1 : b.key === 'undated' ? -1 : b.key.localeCompare(a.key));
    const organizers = [...organizerBuckets.values()].sort((a, b) => (b.checkoutTotal + b.resaleVolume) - (a.checkoutTotal + a.resaleVolume));
    const filters = reportFilters();
    const organizerLabel = filters.organizer ? organizerOptions.get(filters.organizer)?.name || filters.organizer : 'All organizers';
    const monthLabel = filters.month ? new Intl.DateTimeFormat('en-MY', { month: 'long', timeZone: 'UTC' }).format(new Date(`2000-${filters.month}-01T00:00:00Z`)) : 'All months';
    el('#sales-report-scope').textContent = `${organizerLabel} · ${filters.year || 'All years'} · ${monthLabel} · ${filters.grouping === 'year' ? 'Yearly' : 'Monthly'} totals`;
    el('#sales-trend-subtitle').textContent = `${number.format(transactions.length)} recorded sales. ${periods.filter(row => row.key !== 'undated').length > 12 ? 'Chart shows the latest 12 periods; the table includes every period.' : 'Totals by selected report period.'}`;
    el('#sales-report-status').textContent = 'Live Firebase data loaded. Amounts are simulated payment records.';
    renderTrend(periods);
    renderPeriodTable(periods);
    renderOrganizerTable(organizers);
    renderEventTable(buckets);
    renderTransactionTable(transactions);
    lastReport = { transactions, periods, organizers, filters, organizerLabel, monthLabel };

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

function populatePeriodAndOrganizerFilters() {
    const years = new Set([dayKeyFormatter.format(new Date()).slice(0, 4)]);
    const dates = [
        ...bookings.map(row => row.createdAt || row.updatedAt),
        ...resaleListings.map(row => row.completedAt || row.updatedAt || row.createdAt),
        ...tickets.map(row => row.usedAt || row.updatedAt || row.createdAt)
    ];
    dates.forEach(value => { const date = asDate(value); if (date) years.add(dayKeyFormatter.format(date).slice(0, 4)); });
    el('#sales-year-filter').innerHTML = '<option value="">All years</option>' + [...years].sort().reverse().map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join('');
    organizerOptions = new Map([...organizerById].map(([id, user]) => [id, { id, name: user.organizationName || user.fullName || id }]));
    [...events.map(event => ({ eventId: event.id })), ...bookings, ...resaleListings, ...tickets].forEach(record => {
        const details = organizerDetails(record);
        if (!organizerOptions.has(details.key)) organizerOptions.set(details.key, details);
    });
    el('#sales-organizer-filter').innerHTML = '<option value="">All organizers</option>' + [...organizerOptions].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, organizer]) => `<option value="${escapeHtml(id)}">${escapeHtml(organizer.name)}${organizer.id ? ` (${escapeHtml(organizer.id)})` : ''}</option>`).join('');
}

function resetFilters() {
    el('#sales-year-filter').value = '';
    el('#sales-month-filter').value = '';
    el('#sales-organizer-filter').value = '';
    el('#sales-group-filter').value = 'month';
    el('#sales-date-from').value = '';
    el('#sales-date-to').value = '';
    el('#sales-event-filter').value = '';
    el('#sales-source-filter').value = '';
    applyReport();
}

function csvCell(value) {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
    if (!reportLoaded) return;
    const report = lastReport, filters = report.filters;
    const rows = [
        ['TickSecure Sales Report'], ['Generated (UTC)', new Date().toISOString()],
        ['Financial note', 'Recorded simulated-payment data only; not real payment settlement. Checkout totals include service charges. Resale activity is not organizer income.'],
        ['Time zone', 'Malaysia (UTC+8)'], ['Year', filters.year || 'All years'], ['Month', report.monthLabel],
        ['Organizer', report.organizerLabel], ['Report view', filters.grouping === 'year' ? 'Yearly' : 'Monthly'],
        ['Date from', filters.from || 'Any'], ['Date to', filters.to || 'Any'],
        ['Event', filters.event ? eventById.get(filters.event)?.name || filters.event : 'All events'],
        ['Sale source', filters.source || 'All recorded sales'], [],
        ['Sales by period'], ['Period', 'Bookings', 'Tickets', 'Checkout total (RM)', 'Service charges (RM)', 'Resale volume (RM)', 'Total sales activity (RM)', 'Checked in'],
        ...report.periods.map(row => [row.name, row.confirmedBookings, row.tickets, row.checkoutTotal.toFixed(2), row.serviceCharges.toFixed(2), row.resaleVolume.toFixed(2), (row.checkoutTotal + row.resaleVolume).toFixed(2), row.checkedIn]), [],
        ['Sales by organizer'], ['Organizer', 'Organizer ID', 'Events', 'Bookings', 'Tickets', 'Checkout total (RM)', 'Resale volume (RM)', 'Total sales activity (RM)'],
        ...report.organizers.map(row => [row.name, row.id, row.events.size, row.confirmedBookings, row.tickets, row.checkoutTotal.toFixed(2), row.resaleVolume.toFixed(2), (row.checkoutTotal + row.resaleVolume).toFixed(2)]), [],
        ['Recorded sales'], ['Record ID', 'Source', 'Recorded (UTC+8)', 'Event', 'Organizer', 'Organizer ID', 'Category', 'Buyer / seller', 'Tickets', 'Amount (RM)', 'State', 'Payment marker'],
        ...report.transactions.map(transaction => [transaction.id, transaction.source, formatRecordedAt(transaction.recordedAt), transaction.eventName, transaction.organizerName, transaction.organizerId, transaction.categoryName, transaction.party, transaction.tickets, amount(transaction.amount).toFixed(2), transaction.state, transaction.paymentState])
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticksecure-sales-${filters.grouping}-${filters.year || 'all-years'}-${filters.month || 'all-months'}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    el('#btn-apply-sales-filters').addEventListener('click', applyReport);
    el('#btn-reset-sales-filters').addEventListener('click', resetFilters);
    el('#btn-export-sales').addEventListener('click', exportCsv);
}

window.addEventListener('ts-auth-ready', async () => {
    bindControls();
    const version = ++loadVersion;
    reportLoaded = false;
    el('#btn-export-sales').disabled = el('#btn-apply-sales-filters').disabled = true;
    if (window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return;
    const currentUid = window.tsCurrentUser.uid;
    try {
        const data = await Promise.all([
            window.tsBookings.getBookings(), window.tsResale.getListings(), window.tsTickets.getTickets(),
            window.tsEvents.getAdminEvents(), window.tsUsers.getUsers({ role: 'organizer' })
        ]);
        if (version !== loadVersion || window.tsCurrentUser?.uid !== currentUid || window.tsCurrentUser?.role !== 'admin' || window.tsCurrentUser.status !== 'active') return;
        [bookings, resaleListings, tickets, events] = data;
        organizerById = new Map(data[4].filter(user => user.role === 'organizer').map(user => [String(user.id), user]));
        eventById = new Map(events.map(event => [String(event.id), event]));
        populateEventFilter(); populatePeriodAndOrganizerFilters();
        reportLoaded = true;
        el('#btn-export-sales').disabled = el('#btn-apply-sales-filters').disabled = false;
        applyReport();
    } catch (error) {
        if (version !== loadVersion) return;
        console.error('Unable to load the sales report:', error);
        el('#sales-report-status').textContent = 'Could not load the complete sales report. Refresh to retry. Export is unavailable until all organizer sales have loaded.';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Sales Report', 'reports', $content, '..', 'Administrator');
?>
