(function (root) {
    const money = value => Math.round(Number(value) * 100) / 100;
    function timestamp(value, end = false) {
        const raw = String(value || '').trim();
        if (!raw) return NaN;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Date.parse(raw + (end ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00'));
        return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw) ? raw + '+08:00' : raw);
    }
    function limits(event, ticket) {
        const categories = Array.isArray(event?.categories) ? event.categories : Object.entries(event?.categories || {}).map(([sectionId, category]) => ({ ...category, sectionId }));
        const category = categories.find(item => String(item.sectionId || item.section || '') === String(ticket.sectionId || ''));
        const originalPrice = money(category?.price ?? ticket.originalPrice ?? ticket.unitPrice ?? 0);
        const fixed = Number(event?.maxResalePrice || 0);
        const maximum = fixed > 0 ? money(fixed) : money(originalPrice * (1 + Number(event?.maxResaleMarkup || 0) / 100));
        return { originalPrice, maximum };
    }
    function unavailable(event, now = Date.now()) {
        if (event?.status !== 'PUBLISHED') return 'This event is not currently published.';
        if (event.resaleEnabled !== true) return 'The organizer has disabled resale.';
        const start = timestamp(event.resaleStartDate), end = timestamp(event.resaleDeadline, true);
        if (event.resaleStartDate && (!Number.isFinite(start) || now < start)) return 'The resale window has not opened.';
        if (event.resaleDeadline && (!Number.isFinite(end) || now > end)) return 'The resale window has closed.';
        return '';
    }
    function price(value, maximum) {
        const raw = String(value ?? '').trim();
        return /^\d{1,7}(?:\.\d{1,2})?$/.test(raw) && Number(raw) > 0 && Number(raw) <= Math.min(maximum, 1000000);
    }
    const api = { limits, unavailable, price, timestamp };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.tsResalePolicy = api;
})(typeof window === 'object' ? window : globalThis);
