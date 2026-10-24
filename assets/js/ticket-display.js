// Shared presentation helpers for the buyer's booking and ticket records.
window.tsTicketDisplay = {
    date(value, includeTime = true) {
        if (!value) return 'Not available';
        let date;
        if (typeof value.toDate === 'function') date = value.toDate();
        else if (typeof value.seconds === 'number') date = new Date(value.seconds * 1000);
        else {
            let raw = String(value);
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) raw += '+08:00';
            date = new Date(raw);
        }
        if (Number.isNaN(date.getTime())) return 'Date to be announced';
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
            ...(includeTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {})
        }).format(date);
    },
    eventDate(ticket, event) {
        const date = event?.date || ticket.eventDate;
        if (!date) return 'Date to be announced';
        const time = event?.time;
        return this.date(time && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T${time}` : date, Boolean(time || String(date).includes('T')));
    },
    money(value) {
        return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value) || 0);
    },
    chip(container, label, tone = 'neutral') {
        const span = document.createElement('span');
        span.className = `ts-chip ts-chip-${tone}`;
        span.textContent = label;
        container.replaceChildren(span);
    },
    ticketStatus(value) {
        return ({ VALID: ['Valid', 'success'], LISTED_FOR_RESALE: ['Listed for resale', 'gold'], USED: ['Used', 'info'],
            TRANSFERRED: ['Transferred', 'neutral'], CANCELLED: ['Cancelled', 'error'], EXPIRED: ['Expired', 'error'] })[String(value).toUpperCase()]
            || ['Status unavailable', 'neutral'];
    },
    windowOpen(start, end) {
        const parse = (value, last) => {
            let raw = String(value).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += last ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00';
            else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) raw += '+08:00';
            return Date.parse(raw);
        };
        if (start && (!Number.isFinite(parse(start, false)) || Date.now() < parse(start, false))) return false;
        if (end && (!Number.isFinite(parse(end, true)) || Date.now() > parse(end, true))) return false;
        return true;
    }
};
