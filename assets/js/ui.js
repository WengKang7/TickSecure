(function () {

  // ============================================================
// UI PREVIEW MODE
// true  = design review only, no validation / backend submit
// false = normal system behaviour later
// ============================================================

const UI_PREVIEW_MODE = true;

if (UI_PREVIEW_MODE) {

    // Disable HTML form validation
    document.querySelectorAll('form').forEach(function (form) {

        form.setAttribute('novalidate', 'novalidate');

        form.addEventListener('submit', function (event) {

            // Prevent actual backend submission
            event.preventDefault();

        });

    });


    // Remove required validation temporarily
    document.querySelectorAll('[required]').forEach(function (field) {

        field.removeAttribute('required');

    });


    // Remove custom validation attributes if you add them later
    document.querySelectorAll('[pattern]').forEach(function (field) {

        field.removeAttribute('pattern');

    });


    document.querySelectorAll('[minlength]').forEach(function (field) {

        field.removeAttribute('minlength');

    });


    document.querySelectorAll('[maxlength]').forEach(function (field) {

        field.removeAttribute('maxlength');

    });

}

  
  const $ = (s, c = document) => c.querySelector(s); const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  // sidebar
  $$('.ts-sidebar-toggle').forEach(b => b.addEventListener('click', () => $('.ts-sidebar')?.classList.toggle('open')));
  // tabs
  $$('[data-tabs]').forEach(w => {
    const tabs = $$('[data-tab]', w), panels = $$('[data-panel]', w);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active')); panels.forEach(x => x.classList.remove('active'));
      t.classList.add('active'); const p = $(`[data-panel="${t.dataset.tab}"]`, w); if (p) p.classList.add('active');
    }));
  });
  // accordions
  $$('.ts-accordion-trigger').forEach(b => b.addEventListener('click', () => b.closest('.ts-accordion')?.classList.toggle('open')));
  // modal triggers
  $$('[data-modal-open]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.modalOpen)?.classList.add('open')));
  $$('[data-modal-close]').forEach(b => b.addEventListener('click', () => b.closest('.ts-modal-backdrop')?.classList.remove('open')));
  $$('.ts-modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') }));
  // toggles
  $$('.ts-toggle').forEach(t => t.addEventListener('click', () => t.classList.toggle('is-on')));
  // quantity
  $$('[data-qty]').forEach(w => {
    const out = $('[data-qty-value]', w); let val = Number(out?.textContent || 1), min = Number(w.dataset.min || 1), max = Number(w.dataset.max || 8);
    $('[data-qty-minus]', w)?.addEventListener('click', () => { val = Math.max(min, val - 1); out.textContent = val });
    $('[data-qty-plus]', w)?.addEventListener('click', () => { val = Math.min(max, val + 1); out.textContent = val });
  });
  // countdown
  $$('[data-countdown]').forEach(el => {
    let sec = Number(el.dataset.countdown || 582);
    const tick = () => { if (sec < 0) return; const m = Math.floor(sec / 60), s = sec % 60; el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); sec--; };
    tick(); setInterval(tick, 1000);
  });
  // blueprint section selection
  $$('[data-section-card]').forEach(card => card.addEventListener('click', () => {
    const id = card.dataset.sectionCard; $$('[data-section-card]').forEach(x => x.classList.remove('active')); card.classList.add('active');
    $$('[data-section-box]').forEach(x => x.classList.toggle('active', x.dataset.sectionBox === id));
  }));
  // role selection
  $$('.ts-role-card').forEach(card => card.addEventListener('click', () => { $$('.ts-role-card').forEach(x => x.classList.remove('active')); card.classList.add('active'); const hidden = $('[name="role"]'); if (hidden) hidden.value = card.dataset.role || ''; }));
  // toasts
  $$('[data-toast]').forEach(b => b.addEventListener('click', () => { const t = $('.ts-toast'); if (!t) return; t.querySelector('span').textContent = b.dataset.toast || 'UI preview action'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200) }));
  // fake upload display
  /*$$('input[type=file][data-file-name]').forEach(input=>input.addEventListener('change',()=>{const out=document.getElementById(input.dataset.fileName);if(out&&input.files[0])out.textContent=input.files[0].name;}));*/
  // simple filter card selection
  $$('[data-select-card]').forEach(c => c.addEventListener('click', () => { const g = c.parentElement; $$('[data-select-card]', g).forEach(x => x.classList.remove('selected')); c.classList.add('selected') }));
})();
