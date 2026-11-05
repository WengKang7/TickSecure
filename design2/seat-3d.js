/* Bridge to the original DESIGN1 renderer. No inventory or wallet access. */
(function () {
  'use strict';
  let host, controller, config, focusId = null, info = {}, failed = false;
  const byId = id => document.getElementById(id);
  function sync() {
    if (!config || !byId('d2-view-3d')) return;
    const active = config.mode === '3d' && !!controller;
    const frame = byId('d2-three-board'), plan = byId('d2-two-board');
    frame.hidden = !active; plan.hidden = active;
    byId('d2-view-3d').setAttribute('aria-pressed',String(active));
    byId('d2-view-3d').disabled = failed || !controller;
    byId('d2-view-2d').setAttribute('aria-pressed',String(!active));
    byId('d2-people-controls').hidden = !active;
    byId('d2-people').checked = !!info.showPeople;
    byId('d2-people').disabled = !active || !info.peopleAvailable;
    const motion = byId('d2-people-motion');
    motion.disabled = !active || !info.showPeople || !!info.reducedMotion;
    motion.textContent = info.reducedMotion ? 'Reduced motion' : info.peopleMotion === false ? 'Play animation' : 'Pause animation';
    motion.setAttribute('aria-pressed',String(!!info.showPeople && !!info.peopleMotion));
    byId('d2-seat-overview').hidden = !active || !info.viewSeatId;
    byId('d2-3d-status').textContent = info.viewSeatId ? `View from seat ${info.viewSeatId}` : active ? '3D venue overview' : '2D seating plan';
    byId('d2-3d-note').hidden = !active;
    byId('d2-3d-fallback').hidden = !failed;
    byId('d2-3d-legend').hidden = !active;
    byId('d2-2d-legend').hidden = active;
    const seat = config.model.seats.find(s => s.id === focusId);
    byId('d2-focused-seat').hidden = !seat;
    if (seat) {
      byId('d2-focused-label').textContent = `Seat ${seat.seatLabel} · ${seat.status.toLowerCase()}${config.selected.includes(seat.id) ? ' · selected' : ''}`;
      byId('d2-view-from-seat').disabled = failed || !controller;
      byId('d2-view-from-seat').textContent = active && info.viewSeatId === seat.id ? 'Viewing from this seat' : 'View from this seat';
    }
    controller?.setVisible(active);
  }
  function dispose() {
    controller?.dispose(); controller = null; host = null; info = {}; focusId = null;
  }
  function attach(next) {
    const placeholder = byId('d2-three-board');
    if (!placeholder) { dispose(); config = null; return; }
    config = next;
    if (host && controller) placeholder.replaceWith(host);
    else {
      host = placeholder;
      host.hidden = false;
      try {
        controller = window.tsSeatView3D?.mount(host, {
          whiteBackground: true,
          onSeatSelect: id => config.onSelect(Number(id)),
          onFocus: id => { focusId = id; config.onFocus(id); sync(); },
          onViewChange: nextInfo => { info = nextInfo; sync(); }
        }) || null;
      } catch (_) { controller = null; }
      failed = !controller;
      if (failed) { config.mode = '2d'; config.onFallback?.(); }
    }
    controller?.update(config.model,config.selected);
    if (config.focus && config.focus !== focusId) controller?.focus(config.focus);
    sync();
    controller?.resize();
  }
  window.d2Seat3D = {
    attach, dispose,
    zoom: factor => controller?.zoom(factor),
    reset: () => { controller?.overview(); controller?.reset(); },
    viewFrom: () => focusId && controller?.viewFrom(focusId),
    overview: () => controller?.overview(),
    people: enabled => controller?.setPeople(enabled),
    motion: () => controller?.setPeopleMotion(!info.peopleMotion)
  };
  window.addEventListener('pagehide',dispose);
  window.addEventListener('pageshow',event => { if(event.persisted) config?.remount(); });
})();
