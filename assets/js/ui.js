(function () {

  const $ = (s, c = document) => c.querySelector(s); const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  // sidebar
  $$('.ts-sidebar-toggle').forEach(b => b.addEventListener('click', () => $('.ts-sidebar')?.classList.toggle('open')));
  // tabs
  $$('[data-tabs]').forEach(w => {
    const tabs = $$('[data-tab]', w), panels = $$('[data-panel]', w);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active')); panels.forEach(x => x.classList.remove('active'));
      t.classList.add('active'); const p = $(`[data-panel="${t.dataset.tab}"]`, w); if (p) p.classList.add('active');
      window.dispatchEvent(new CustomEvent('ts-tab-change', { detail: { container: w, panel: p } }));
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
  const region = document.createElement('div');
  region.className = 'ts-feedback-region';
  region.setAttribute('aria-label', 'Notifications');
  document.body.appendChild(region);
  const notices = new Map();
  function dismiss(key) {
    const notice = notices.get(key);
    if (!notice) return;
    clearTimeout(notice.timer);
    notice.node.remove();
    notices.delete(key);
  }
  window.tsShowToast = (message, kind = 'success', key = Symbol()) => {
    dismiss(key);
    if (!String(message || '').trim()) return;
    const notice = document.createElement('div');
    notice.className = 'ts-feedback-toast';
    notice.dataset.kind = kind;
    notice.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const icon = document.createElement('span');
    icon.className = 'ts-feedback-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'processing' ? '' : kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i';
    const text = document.createElement('span');
    text.textContent = String(message);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'ts-feedback-close';
    close.setAttribute('aria-label', 'Dismiss notification'); close.textContent = '×';
    close.onclick = () => dismiss(key);
    notice.append(icon, text, close);
    region.appendChild(notice);
    const entry = { node: notice, timer: null };
    notices.set(key, entry);
    if (kind !== 'processing') entry.timer = setTimeout(() => dismiss(key), kind === 'error' ? 12000 : 6500);
  };
  window.alert = message => window.tsShowToast(String(message), 'error');

  // Mirror action feedback while preserving field-level errors and controls.
  const selector = '.ts-global-error,.ts-global-success,.ts-alert,[role="alert"],[role="status"],[id$="-error"],[id$="-message"],[id$="-status"]';
  const previous = new WeakMap();
  function syncFeedback(source, initial = false) {
    if (!(source instanceof HTMLElement) || !source.matches(selector) ||
        source.closest('.ts-feedback-region,.ts-toast,.ts-decision-backdrop,.ts-modal-backdrop') ||
        source.matches('.ts-error-msg,.ts-field-error,[id^="val-"],[id^="ai-review-"],#category-selected-count,#event-location-status') ||
        source.closest('.ts-field,.ts-input-wrap') ||
        source.querySelector('button,a,input,select,textarea')) return;
    const text = source.textContent.replace(/\s+/g, ' ').trim();
    const visible = !source.hidden && getComputedStyle(source).display !== 'none' &&
      !source.closest('[hidden]') && [...source.parentElement?.getClientRects() || []].length > 0;
    const value = visible ? text : '';
    if (previous.get(source) === value) return;
    previous.set(source, value);
    if (!value) { dismiss(source); return; }
    const error = source.matches('.ts-global-error,.ts-alert-error,[role="alert"],[id$="-error"]');
    const success = source.matches('.ts-global-success,.ts-alert-success') || /\b(successful(?:ly)?|saved|completed|confirmed|updated|deleted|approved|registered)\b/i.test(value);
    const processing = /^(loading|saving|uploading|processing|checking|connecting|verifying|submitting|sending|preparing|detecting|opening|minting)\b/i.test(value) || /please wait|in progress|awaiting.*confirmation/i.test(value);
    // Informational page copy is retained until it becomes action feedback.
    if (initial && !error && !success && !processing) return;
    source.classList.add('ts-feedback-source');
    window.tsShowToast(value, error ? 'error' : processing ? 'processing' : success ? 'success' : 'info', source);
  }
  document.querySelectorAll(selector).forEach(source => syncFeedback(source, true));
  const observer = new MutationObserver(records => {
    const sources = new Set();
    records.forEach(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      if (!target || target.closest('.ts-feedback-region')) return;
      const source = target.closest(selector);
      if (source) sources.add(source);
      if (record.type === 'childList' || record.attributeName === 'hidden' || record.attributeName === 'style') {
        target.querySelectorAll(selector).forEach(item => sources.add(item));
      }
    });
    notices.forEach((_, key) => { if (key instanceof HTMLElement && !key.isConnected) dismiss(key); });
    sources.forEach(source => syncFeedback(source));
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden','style'] });
  window.addEventListener('pagehide', () => {
    observer.disconnect(); notices.forEach((_, key) => dismiss(key));
  });
  $$('[data-toast]').forEach(b => b.addEventListener('click', () => window.tsShowToast(b.dataset.toast)));
  // fake upload display
  /*$$('input[type=file][data-file-name]').forEach(input=>input.addEventListener('change',()=>{const out=document.getElementById(input.dataset.fileName);if(out&&input.files[0])out.textContent=input.files[0].name;}));*/
  // simple filter card selection
  $$('[data-select-card]').forEach(c => c.addEventListener('click', () => { const g = c.parentElement; $$('[data-select-card]', g).forEach(x => x.classList.remove('selected')); c.classList.add('selected') }));
})();
