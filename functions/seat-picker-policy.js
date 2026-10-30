// Public projection: never return reservation owners, booking IDs or other buyers' expiries.
function visibleSeat(seat, uid, fallback = {}, currentTime = Date.now()) {
    const active = Date.parse(seat.reservationExpiry || '') > currentTime;
    let status = seat.status === 'RESERVED' ? active ? seat.reservedBy === uid ? 'MINE' : 'HELD' : 'AVAILABLE'
        : ['AVAILABLE', 'SOLD'].includes(seat.status) ? seat.status : 'BLOCKED';
    const result = { id: seat.id, sectionId: seat.sectionId, seatLabel: seat.seatLabel, status,
        row: String(seat.rowLabel || fallback.row || ''), number: String(seat.seatNumber || fallback.number || '') };
    const position = seat.position || fallback;
    if (Number.isFinite(position.x) && Number.isFinite(position.y) && position.x >= 0 && position.x <= 104 && position.y >= 0 && position.y <= 106) {
        result.position = { x: position.x, y: position.y, page: Number.isInteger(position.page) && position.page > 0 ? position.page : 1,
            width: Number.isFinite(position.width) && position.width > 0 ? position.width : 2.8,
            height: Number.isFinite(position.height) && position.height > 0 ? position.height : 2.8,
            rotation: Number.isFinite(position.rotation) ? position.rotation : 0, shape: position.shape === 'rect' ? 'rect' : 'circle' };
    }
    if (status === 'MINE') result.reservationExpiry = seat.reservationExpiry;
    return result;
}
function checkSelected(seats, ids, context) {
    const byId = new Map(seats.map(seat => [seat.id, seat]));
    return ids.map(id => {
        const seat = byId.get(id);
        if (!seat || seat.eventId !== context.eventId || seat.venueId !== context.venueId || seat.sectionId !== context.sectionId) throw Object.assign(new Error('A selected seat does not belong to this event and section.'), { code: 'invalid-argument' });
        if (seat.status !== 'AVAILABLE' && !(seat.status === 'RESERVED' && (!(Date.parse(seat.reservationExpiry || '') > context.now) || seat.reservedBy === context.uid))) {
            throw Object.assign(new Error('A selected seat was just taken. Refresh the map and choose another seat.'), { code: 'already-exists' });
        }
        return seat;
    });
}
// Public physical geometry only; these contextual chairs are not reservable inventory.
function layoutContext(sections) {
    const result = [], labels = new Set();
    for (const section of sections || []) for (const marker of section.geometry?.seatMarkers || []) {
        if (result.length >= 5000) return result;
        if (!marker.label || !section.sectionId) continue;
        const seatLabel = `${section.sectionId}-${marker.label}`;
        if (labels.has(seatLabel)) continue;
        const seat = visibleSeat({ id: '', sectionId: '', seatLabel, status: 'BLOCKED' }, '', { ...marker, page: section.geometry.page || 1 });
        if (!seat.position) continue;
        labels.add(seatLabel); result.push({ seatLabel, number: seat.number, position: seat.position });
    }
    return result;
}
module.exports = { visibleSeat, checkSelected, layoutContext };
