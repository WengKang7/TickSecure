// Public projection only. Never return seat IDs, buyers or reservation details.
function eventAvailability(event, physicalSeats, eventSeats, currentTime = Date.now()) {
    const physicalCounts = new Map();
    for (const seat of physicalSeats) {
        if (seat.venueId === event.venueId && seat.sectionId && String(seat.seatLabel || '').trim()) {
            physicalCounts.set(String(seat.sectionId), (physicalCounts.get(String(seat.sectionId)) || 0) + 1);
        }
    }
    const blocked = new Map();
    for (const seat of eventSeats) {
        if (seat.eventId !== event.id || seat.venueId !== event.venueId) continue;
        const reusable = seat.status === 'AVAILABLE' || (seat.status === 'RESERVED'
            && !(Date.parse(seat.reservationExpiry || '') > currentTime));
        if (!reusable) blocked.set(String(seat.sectionId), (blocked.get(String(seat.sectionId)) || 0) + 1);
    }
    const entries = Array.isArray(event.categories)
        ? event.categories.map(category => [category?.sectionId || category?.section || category?.id, category])
        : Object.entries(event.categories || {});
    const categories = entries.filter(([id, category]) => id && category && typeof category === 'object').map(([id, category]) => {
        const sectionId = String(id);
        const value = Number(category.quantity ?? category.available ?? 0);
        const allocated = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        // Reservation cannot succeed when the allocation exceeds physical inventory.
        const capacity = (physicalCounts.get(sectionId) || 0) >= allocated ? allocated : 0;
        return { sectionId, allocated, remaining: Math.max(0, capacity - (blocked.get(sectionId) || 0)) };
    });
    return { eventId: event.id, checkedAt: new Date(currentTime).toISOString(), categories,
        remaining: categories.reduce((sum, category) => sum + category.remaining, 0) };
}

module.exports = { eventAvailability };
