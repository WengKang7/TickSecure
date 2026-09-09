<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?php

$eventVenueId = 'merdeka-hall';

$eventCategoryMap = [

    'A' => [
        'name' => 'VIP1',
        'price' => 'RM688'
    ],

    'B' => [
        'name' => 'VIP2',
        'price' => 'RM488'
    ],

    'C' => [
        'name' => 'CAT1',
        'price' => 'RM288'
    ]

];

?>

<main class="ts-section-tight">
  <div class="ts-container">
          <div class="ts-card ts-card-pad mb-24">

    <div class="ts-card-title">
        Choose Your Ticket Category
    </div>

    <div class="ts-card-sub">
        Use the venue layout to understand where each
        ticket category is located.
    </div>


    <div class="mt-20">

        <?= ts_render_venue_layout(
            $eventVenueId,
            'buyer',
            $eventCategoryMap
        ) ?>

    </div>
    <div class="ts-steps">
      
      <div class="ts-step active"><span class="ts-step-num">1</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">2</span>Seat Assignment</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Wallet</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">4</span>Payment</div>
    </div>
    <div class="ts-content-grid">
      <div>
        <div class="ts-section-eyebrow">Aurora After Dark</div>
        <h1 class="ts-section-title">Choose your ticket category</h1>
        <p class="ts-section-copy mb-24">Select a category and quantity. TickSecure will automatically assign the next
          available seats in the mapped venue section.</p>
        <div class="ts-category-list">
          <div class="ts-card ts-card-pad mb-24">

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
          <p class="small muted text-center">Maximum 4 tickets per buyer.</p>
        </div>
      </aside>
    </div>
  </div>
</main>

<script type="module">
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

<?php
$content = ob_get_clean();
render_public_page('Select Ticket Category', 'events', $content, '..', true);
?>