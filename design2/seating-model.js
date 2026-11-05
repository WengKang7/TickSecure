/* Illustrative positioned venue, shared by the event page and sample checkout. */
(function (root) {
  'use strict';
  const seats = [];
  const sold = new Set([4, 9, 15, 20, 31, 36, 44, 45, 55, 61, 69, 88, 103, 121, 144]);
  const held = new Set([26, 72, 97, 132]);
  let id = 0;
  // Ten gently curved rows, wider towards the rear; stage is at the bottom.
  for (let row = 0; row < 10; row++) {
    const count = 12 + row;
    for (let col = 0; col < count; col++) {
      const offset = col - (count - 1) / 2;
      const number = ++id;
      seats.push(Object.freeze({
        id: number, label: String(number), row: String.fromCharCode(65 + row),
        x: 320 + offset * 27, y: 449 - row * 40 + offset * offset * .16,
        category: row < 3 ? 1 : row < 8 ? 0 : 2,
        status: sold.has(number) ? 'Sold' : held.has(number) ? 'Held' : 'Available'
      }));
    }
  }
  const get = id => seats.find(seat => seat.id === Number(id));
  const available = category => seats.filter(seat => seat.category === category && seat.status === 'Available');
  function select(current, id) {
    const seat = get(id);
    if (!seat || seat.status !== 'Available') return { ...current, error: 'This seat is not available.' };
    const selected = current.category === seat.category ? [...current.seats] : [];
    const index = selected.indexOf(seat.id);
    if (index >= 0) selected.splice(index, 1);
    else if (selected.length >= current.quantity) return { ...current, error: `Choose up to ${current.quantity} seats. Change the ticket quantity to select more.` };
    else selected.push(seat.id);
    return { ...current, category: seat.category, seats: selected, error: '' };
  }
  function valid(current) {
    return Number.isInteger(current.quantity) && current.quantity >= 1 && current.quantity <= 4
      && current.seats.length === current.quantity && new Set(current.seats).size === current.quantity
      && current.seats.every(id => { const seat = get(id); return seat?.status === 'Available' && seat.category === current.category; });
  }
  // Adapt the same sample seats to DESIGN1's original 3D renderer contract.
  const sceneModel = {
    seats: seats.map(seat => ({
      id: String(seat.id), seatLabel: String(seat.label), number: String(seat.label),
      status: seat.status.toUpperCase(),
      position: {x:seat.x/640*104, y:seat.y/598*106, width:22/640*104, height:22/598*106, page:1}
    })),
    geometry: {pages:{1:{imageWidth:640,imageHeight:598,decorations:[{
      name:'STAGE', points:[{x:29.12,y:90.1},{x:74.88,y:90.1},{x:74.88,y:98.58},{x:29.12,y:98.58}]
    }]}}}
  };
  const api = { seats: Object.freeze(seats), get, available, select, valid, sceneModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.d2Seating = api;
})(typeof window !== 'undefined' ? window : globalThis);
