<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
  <div class="ts-container">
    <div class="ts-steps">
      
      <div class="ts-step active"><span class="ts-step-num">1</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">2</span>Seat Assignment</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Wallet</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">4</span>Payment</div>
    </div>
    <div class="ts-content-grid">
      <div>
        <div class="ts-section-eyebrow" id="event-name">Loading event</div>
        <h1 class="ts-section-title">Choose your ticket category</h1>
        <p class="ts-section-copy mb-24">Select a category and quantity. TickSecure will automatically assign the next
          available seats in the mapped venue section.</p>
        <div class="ts-card ts-card-pad mb-24">
          <div class="ts-card-title">Venue</div>
          <div class="ts-card-sub" id="venue-context">Loading venue details...</div>
          <p class="small muted mt-12">Seats are assigned automatically from the selected venue section. Live availability is checked in the secure reservation step.</p>
        </div>
        <div class="ts-category-list">
          <div class="ts-card ts-card-pad mb-24" hidden>

    <div class="ts-card-title">
        Venue Layout
    </div>

    <div class="ts-card-sub">
        Merdeka Hall · Choose a category based on its location.
    </div>


    <div class="ts-mini-venue-layout mt-16">

        <div class="ts-mini-stage">
            STAGE
        </div>

        <div class="ts-mini-section mini-a">

            <strong>VIP1</strong>
            <span>Section A</span>
            <span>RM688</span>

        </div>

        <div class="ts-mini-section mini-b">

            <strong>CAT1</strong>
            <span>Section B</span>
            <span>RM488</span>

        </div>

        <div class="ts-mini-section mini-c">

            <strong>CAT2</strong>
            <span>Section C</span>
            <span>RM288</span>

        </div>

    </div>
          </div>

        <div class="ts-category-list" id="category-list">
          <p class="secondary text-center" style="padding:20px">Loading categories...</p>
        </div>
        <div class="ts-note mt-20">
          <?=ts_icon('shield')?>
          <div><strong>Automatic seat assignment</strong>
            <div class="small mt-8">Seats are assigned by the next available assignment order within the selected
              category. You will see the assigned seat numbers before payment.</div>
          </div>
        </div>
      </div>
      <aside>
        <div class="ts-card ts-card-pad ts-order-summary">
          <div class="ts-card-title">Order summary</div>
          <div id="summary-content">
             <div class="ts-summary-row"><span id="summary-cat">Select a category</span><strong id="summary-price">-</strong></div>
             <div class="ts-summary-row"><span>Service charge</span><strong id="summary-fee">RM20.00</strong></div>
             <div class="ts-summary-row total"><span>Total</span><span id="summary-total">-</span></div>
          </div>
          <a class="ts-btn ts-btn-primary w-full mt-16" href="#" id="btn-continue">Continue</a>
          <p class="small muted text-center" id="buyer-limit">Maximum 4 tickets per buyer.</p>
        </div>
      </aside>
    </div>
  </div>
</main>

<script type="text/plain" data-legacy-category-script>
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    if (!eventId) return;

    let selectedCat = null;
    let qty = 1;

    try {
        const event = await window.tsEvents.getEvent(eventId);
        const container = document.getElementById('category-list');
        const categories = event.categories || [];
        
        if (categories.length === 0) {
            container.innerHTML = '<p class="secondary text-center">No categories available.</p>';
            return;
        }

        const renderCategories = () => {
            container.innerHTML = categories.map(cat => {
                const isSelected = selectedCat && selectedCat.id === cat.id;
                return \`
                  <div class="ts-category-card \${isSelected ? 'selected' : ''}" data-id="\${cat.id}">
                    <div>
                      <div class="ts-category-name">\${cat.name}</div>
                      <div class="ts-category-meta">Section \${cat.section || '-'} · \${cat.available || 0} remaining · auto-assigned seating</div>
                    </div>
                    <div class="flex items-center gap-16">
                      <div class="ts-category-price">RM\${cat.price}</div>
                      \${isSelected ? \`
                      <div class="flex items-center gap-8">
                          <button class="ts-icon-btn btn-minus">−</button>
                          <strong>\${qty}</strong>
                          <button class="ts-icon-btn btn-plus">+</button>
                      </div>\` : ''}
                    </div>
                  </div>
                \`;
            }).join('');
            
            // Attach events
            container.querySelectorAll('.ts-category-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-minus') || e.target.closest('.btn-plus')) return;
                    const catId = card.getAttribute('data-id');
                    selectedCat = categories.find(c => c.id === catId);
                    qty = 1;
                    renderCategories();
                    updateSummary();
                });
            });
            
            if (selectedCat) {
                const btnMinus = container.querySelector('.selected .btn-minus');
                const btnPlus = container.querySelector('.selected .btn-plus');
                if (btnMinus) btnMinus.addEventListener('click', () => { if (qty > 1) { qty--; renderCategories(); updateSummary(); } });
                if (btnPlus) btnPlus.addEventListener('click', () => { if (qty < Math.min(4, selectedCat.available || 4)) { qty++; renderCategories(); updateSummary(); } });
            }
        };

        const updateSummary = () => {
            if (!selectedCat) return;
            document.getElementById('summary-cat').textContent = \`\${selectedCat.name} × \${qty}\`;
            const subtotal = selectedCat.price * qty;
            document.getElementById('summary-price').textContent = \`RM\${subtotal.toFixed(2)}\`;
            document.getElementById('summary-total').textContent = \`RM\${(subtotal + 20).toFixed(2)}\`;
            
            const btn = document.getElementById('btn-continue');
            btn.href = \`seat-assignment.php?eventId=\${eventId}&sectionId=\${selectedCat.sectionId || selectedCat.id}&qty=\${qty}\`;
        };

        renderCategories();
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<script type="module">
const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const asAmount = value => {
    const amount = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
};

const normalizeCategories = (rawCategories, sectionIdsByName = new Map()) => {
    const entries = Array.isArray(rawCategories)
        ? rawCategories.map((category, index) => [
            category?.sectionId ?? category?.id ?? category?.section ?? String(index),
            category
        ])
        : Object.entries(rawCategories || {});

    return entries.map(([key, category]) => {
        const legacySection = String(category?.sectionId ?? category?.id ?? category?.section ?? key ?? '').trim();
        const sectionId = sectionIdsByName.get(legacySection.toLowerCase()) || legacySection;
        return {
            id: sectionId,
            sectionId,
            name: String(category?.name ?? category?.categoryName ?? sectionId).trim() || sectionId,
            price: asAmount(category?.price ?? category?.unitPrice),
            quantity: Math.max(0, Math.floor(asAmount(category?.quantity ?? category?.available)))
        };
    }).filter(category => category.sectionId);
};

let initialized = false;
const initializeCategorySelection = async () => {
    if (initialized) return;
    initialized = true;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const container = document.getElementById('category-list');
    const continueButton = document.getElementById('btn-continue');
    if (!eventId || !container || !continueButton) return;

    let selectedCategory = null;
    let quantity = 1;

    try {
        const event = await window.tsEvents.getEvent(eventId);
        if (!event) throw new Error('Event not found.');

        const eventName = document.getElementById('event-name');
        const venueContext = document.getElementById('venue-context');
        const buyerLimit = document.getElementById('buyer-limit');
        const maximumPerBuyer = Math.max(1, parseInt(event.maxTicketsPerBuyer, 10) || 4);
        if (eventName) eventName.textContent = event.name || 'Event';
        if (buyerLimit) buyerLimit.textContent = `Maximum ${maximumPerBuyer} ticket${maximumPerBuyer === 1 ? '' : 's'} per buyer.`;

        const sectionIdsByName = new Map();
        let venue = null;
        if (event.venueId) {
            try {
                venue = await window.tsVenues.getVenue(event.venueId);
                (venue?.sections || []).forEach(section => {
                    const sectionId = String(section.sectionId ?? '').trim();
                    if (!sectionId) return;
                    sectionIdsByName.set(sectionId.toLowerCase(), sectionId);
                    sectionIdsByName.set(String(section.name ?? '').trim().toLowerCase(), sectionId);
                });
            } catch (error) {
                console.warn('Venue details could not be loaded:', error);
            }
        }
        if (venueContext) {
            const venueName = venue?.name || event.venueName || 'Venue TBA';
            const venueLocation = venue?.location || event.venueLocation || '';
            venueContext.textContent = venueLocation ? `${venueName} - ${venueLocation}` : venueName;
        }

        const categories = normalizeCategories(event.categories, sectionIdsByName);
        if (!categories.length) {
            container.innerHTML = '<p class="secondary text-center">No ticket categories are available for this event.</p>';
            continueButton.removeAttribute('href');
            continueButton.setAttribute('aria-disabled', 'true');
            return;
        }

        // categories.quantity is the fixed event allocation, not live stock.
        // The callable reservation step is the source of truth for current
        // availability and will reject seats that have just sold or are held.
        const categoryLimit = category => Math.min(maximumPerBuyer, category.quantity);

        const updateSummary = () => {
            if (!selectedCategory) return;
            document.getElementById('summary-cat').textContent = `${selectedCategory.name} × ${quantity}`;
            const subtotal = selectedCategory.price * quantity;
            document.getElementById('summary-price').textContent = `RM${subtotal.toFixed(2)}`;
            document.getElementById('summary-total').textContent = `RM${(subtotal + 20).toFixed(2)}`;

            const checkoutParams = new URLSearchParams({
                eventId,
                sectionId: selectedCategory.sectionId,
                qty: String(quantity)
            });
            continueButton.href = `seat-assignment.php?${checkoutParams.toString()}`;
            continueButton.removeAttribute('aria-disabled');
        };

        const renderCategories = () => {
            container.innerHTML = categories.map(category => {
                const isSelected = selectedCategory?.sectionId === category.sectionId;
                const allocation = category.quantity;
                const selectionLimit = categoryLimit(category);
                const isSoldOut = selectionLimit < 1;
                return `
                    <div class="ts-category-card ${isSelected ? 'selected' : ''}${isSoldOut ? ' disabled' : ''}" data-section-id="${escapeHtml(category.sectionId)}" ${isSoldOut ? 'aria-disabled="true"' : ''}>
                        <div>
                            <div class="ts-category-name">${escapeHtml(category.name)}</div>
                            <div class="ts-category-meta">Section ${escapeHtml(category.sectionId)} · ${allocation} allocated · live availability confirmed next</div>
                        </div>
                        <div class="flex items-center gap-16">
                            <div class="ts-category-price">RM${category.price.toFixed(2)}</div>
                            ${isSelected ? `
                                <div class="flex items-center gap-8">
                                    <button type="button" class="ts-icon-btn btn-minus" aria-label="Decrease quantity">−</button>
                                    <strong>${quantity}</strong>
                                    <button type="button" class="ts-icon-btn btn-plus" aria-label="Increase quantity">+</button>
                                </div>` : ''}
                        </div>
                    </div>`;
            }).join('');

            container.querySelectorAll('.ts-category-card').forEach(card => {
                card.addEventListener('click', event => {
                    if (card.getAttribute('aria-disabled') === 'true' || event.target.closest('.btn-minus, .btn-plus')) return;
                    const sectionId = card.dataset.sectionId;
                    selectedCategory = categories.find(category => category.sectionId === sectionId) || null;
                    quantity = 1;
                    renderCategories();
                    updateSummary();
                });
            });

            const minusButton = container.querySelector('.selected .btn-minus');
            const plusButton = container.querySelector('.selected .btn-plus');
            if (minusButton) minusButton.addEventListener('click', () => {
                if (quantity > 1) {
                    quantity -= 1;
                    renderCategories();
                    updateSummary();
                }
            });
            if (plusButton) plusButton.addEventListener('click', () => {
                if (selectedCategory && quantity < categoryLimit(selectedCategory)) {
                    quantity += 1;
                    renderCategories();
                    updateSummary();
                }
            });
        };

        continueButton.removeAttribute('href');
        continueButton.setAttribute('aria-disabled', 'true');
        renderCategories();
    } catch (error) {
        console.error('Category loading failed:', error);
        container.innerHTML = '<p class="secondary text-center">Ticket categories could not be loaded. Please try again.</p>';
        continueButton.removeAttribute('href');
        continueButton.setAttribute('aria-disabled', 'true');
    }
};

window.addEventListener('ts-auth-ready', event => {
    if (event.detail) initializeCategorySelection();
});
if (window.tsCurrentUser) initializeCategorySelection();
</script>

<?php
$content = ob_get_clean();
render_public_page('Select Ticket Category', 'events', $content, '..', true);
?>
