'use strict';

// Validate the entire allocation before writing inventory. A physical chair can
// appear only once in an event, even when several categories share a section.
function allocateSeats(categories, physicalSeats) {
    const entries = Array.isArray(categories) ? categories.map(c => [c?.sectionId || c?.section || c?.id, c]) : Object.entries(categories || {});
    if (!entries.length) throw new Error('This event has no ticket inventory configured.');
    const claimed = new Set(), result = [];
    for (const [sectionId, category] of entries) {
        const quantity = Number(category?.quantity ?? category?.available);
        if (!category || typeof category !== 'object' || Array.isArray(category) || !/^[A-Za-z0-9_-]{1,160}$/.test(sectionId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000
            || typeof category.name !== 'string' || !category.name.trim() || !Number.isFinite(Number(category.price)) || Number(category.price) <= 0) throw new Error('Invalid ticket category configuration.');
        let seats;
        if (Object.hasOwn(category, 'seatLabels')) {
            if (!Array.isArray(category.seatLabels) || category.seatLabels.length !== quantity || new Set(category.seatLabels).size !== quantity
                || category.seatLabels.some(label => typeof label !== 'string' || !label || label.length > 160)) throw new Error('Category quantity must match its unique physical seat labels.');
            const byLabel = new Map(physicalSeats.map(seat => [seat.seatLabel, seat]));
            seats = category.seatLabels.map(label => byLabel.get(label));
            if (seats.some(seat => !seat)) throw new Error('A category references a seat outside this venue.');
        } else {
            seats = physicalSeats.filter(seat => seat.sectionId === sectionId).sort((a, b) => String(a.seatLabel).localeCompare(String(b.seatLabel))).slice(0, quantity);
            if (seats.length !== quantity) throw new Error(`The ${sectionId} allocation exceeds the venue's physical seats.`);
        }
        for (const seat of seats) {
            if (claimed.has(seat.id)) throw new Error('A physical seat belongs to more than one ticket category.');
            claimed.add(seat.id);
            result.push({ sectionId, sourceSeat: seat });
        }
    }
    return result;
}
module.exports = { allocateSeats };
