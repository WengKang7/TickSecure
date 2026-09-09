<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Ticket Configuration', 'Map event-specific ticket categories to physical venue sections, then define price and quantity.', '<button class="ts-btn ts-btn-secondary" data-toast="Configuration saved as draft">Save Draft</button> <button class="ts-btn ts-btn-primary" data-modal-open="confirm-modal">Confirm Configuration</button>')?>
<div class="ts-alert ts-alert-info mb-24">
    <?=ts_icon('layout')?>
    <div><strong>Physical sections come from the Administrator-managed venue layout.</strong>
        <div class="small mt-8">Category names such as VIP1 and CAT1 are event-specific and do not permanently rename
            the venue’s physical sections.</div>
    </div>
</div>
<div class="ts-card ts-card-pad mb-24">

    <div class="flex justify-between items-center">

        <div>
            <div class="ts-card-title">
                Selected Venue Layout
            </div>

            <div class="ts-card-sub">
                Merdeka Hall · Administrator-managed physical layout
            </div>
        </div>

        <?= ts_status('Active', 'success') ?>

    </div>


    <div id="mini-venue-board" class="ts-reusable-venue-plan" style="max-width:760px; margin: 20px auto; background:var(--bg-alt); border-radius:12px;"></div>
</div>

<div class="ts-grid-2">
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Venue Sections · Merdeka Hall</div>
        <div class="ts-list mt-16" id="venue-sections-list">
            Loading...
        </div>
    </div>
    <div class="ts-card ts-card-pad">
        <div class="ts-card-title">Add / Edit Category</div>
        <div class="ts-auth-fields mt-20">
            <div class="ts-field"><label class="ts-label">Category Name</label><input class="ts-input" id="catName" name="catName" value="">
            </div>
            <div class="ts-field"><label class="ts-label">Physical Venue Section</label><select class="ts-select" id="catSection" name="catSection">
                    <option value="">Select Section...</option>
                </select></div>
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label">Ticket Price (RM)</label><input class="ts-input" type="number" id="catPrice" name="catPrice"
                        value=""></div>
                <div class="ts-field"><label class="ts-label">Ticket Quantity</label><input class="ts-input" type="number" id="catQuantity" name="catQuantity" value="">
                </div>
            </div><button class="ts-btn ts-btn-secondary" id="add-cat-btn">Add Category</button>
        </div>
    </div>
</div>
<div class="ts-card mt-24">
    <div class="ts-card-head">
        <div>
            <div class="ts-card-title">Configured Ticket Categories</div>
            <div class="ts-card-sub">Buyer seat numbers are assigned automatically from the mapped section.</div>
        </div>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Physical Section</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Capacity Check</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="categories-tbody">
                <tr><td colspan="6" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="ts-card-title">Sales, Transfer & Resale Rules</div>
    <div class="ts-form-grid mt-20" id="sales-rules-form">
        <div class="ts-field"><label class="ts-label">Sales Start Date / Time</label><input class="ts-input"
                type="datetime-local" id="salesStart" name="salesStart"></div>
        <div class="ts-field"><label class="ts-label">Sales Closing Date / Time</label><input class="ts-input"
                type="datetime-local" id="salesEnd" name="salesEnd"></div>
        <div class="ts-field"><label class="ts-label">Maximum Tickets per Buyer</label><input class="ts-input"
                id="maxTickets" name="maxTickets"></div>
        <div class="ts-field"><label class="ts-label">Maximum Resale Markup (%)</label><input class="ts-input" type="number"
                id="maxResaleMarkup" name="maxResaleMarkup" value="5"></div>
        <div class="ts-field"><label class="ts-label">Resale Start</label><input class="ts-input" type="datetime-local"
                id="resaleStart" name="resaleStart"></div>
        <div class="ts-field"><label class="ts-label">Resale Deadline</label><input class="ts-input"
                type="datetime-local" id="resaleEnd" name="resaleEnd"></div>
    </div>
    <div class="flex gap-24 mt-20">
        <div class="flex items-center gap-12"><input type="checkbox" id="transferEnabled" name="transferEnabled" checked><strong>Transfer Enabled</strong>
        </div>
        <div class="flex items-center gap-12"><input type="checkbox" id="resaleEnabled" name="resaleEnabled" checked><strong>Resale Enabled</strong></div>
    </div>
    <div class="mt-20">
        <button class="ts-btn ts-btn-primary" id="confirm-btn">Submit for Approval</button>
    </div>
</div>

<script src="../assets/js/venue-renderer.js"></script>
<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if(!eventId) return;
    
    try {
        const event = await window.tsEvents.getEvent(eventId);
        let venueSections = [];
        if (event.venueId) {
            const venue = await window.tsVenues.getVenue(event.venueId);
            if (venue && venue.sections) venueSections = venue.sections;
            
            // Update venue name in subtitle
            const subEls = document.querySelectorAll('.ts-card-sub');
            if (subEls.length > 0) {
                subEls[0].textContent = `${venue.name} · Administrator-managed physical layout`;
            }
            const secTitles = document.querySelectorAll('.ts-card-title');
            secTitles.forEach(el => {
                if(el.textContent.includes('Venue Sections')) el.textContent = `Venue Sections · ${venue.name}`;
            });

            if (window.tsVenueRenderer) {
                window.tsVenueRenderer.renderBoard('mini-venue-board', venueSections);
            }
            
            const listEl = document.getElementById('venue-sections-list');
            if (listEl) {
                listEl.innerHTML = venueSections.map(s => `
                    <div class="ts-list-item">
                        <div>
                            <div class="ts-list-title">${esc(s.name)}</div>
                            <div class="ts-list-sub">${s.seatCount} seats · available for mapping</div>
                        </div>
                    </div>
                `).join('');
            }
            
            const secSelect = document.getElementById('catSection');
            if (secSelect) {
                secSelect.innerHTML = '<option value="">Select Section...</option>' + venueSections.map(s => 
                    `<option value="${esc(s.name)}">${esc(s.name)} · ${s.seatCount} seats</option>`
                ).join('');
            }
        }
        
        let existingCats = event.categories || [];
        if (!Array.isArray(existingCats)) existingCats = Object.values(existingCats);

        const tbody = document.getElementById('categories-tbody');
        if (tbody) {
            tbody.innerHTML = existingCats.map((c, i) => {
                // Capacity check logic
                const vSec = venueSections.find(vs => vs.name === c.section);
                const capacity = vSec ? parseInt(vSec.seatCount) || 0 : 0;
                const isOver = c.quantity > capacity;
                const checkChip = isOver ? '<span class="ts-chip ts-chip-danger">Over Capacity</span>' : '<span class="ts-chip ts-chip-success">Valid</span>';

                return `
                <tr>
                    <td class="cell-title">${esc(c.name)}</td>
                    <td>${esc(c.section)}</td>
                    <td>RM${c.price}</td>
                    <td class="${isOver ? 'text-danger' : ''}">${c.quantity} / ${capacity}</td>
                    <td>${checkChip}</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm remove-cat-btn" data-index="${i}">Remove</button></td>
                </tr>
                `;
            }).join('') || '<tr><td colspan="6" class="text-center">No categories configured.</td></tr>';

            // Attach remove listeners
            document.querySelectorAll('.remove-cat-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (!confirm('Are you sure you want to remove this category?')) return;
                    
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    const updatedCats = [...existingCats];
                    updatedCats.splice(idx, 1);
                    
                    e.target.disabled = true;
                    e.target.textContent = 'Removing...';
                    
                    await window.tsEvents.updateCategories(eventId, updatedCats);
                    window.location.reload();
                });
            });
        }

        // Pre-fill rules form if existing
        const rulesForm = document.getElementById('sales-rules-form');
        const V = window.tsValidation;
        if (rulesForm) {
            if(event.salesStartDate) document.getElementById('salesStart').value = event.salesStartDate;
            if(event.salesEndDate) document.getElementById('salesEnd').value = event.salesEndDate;
            if(event.maxTicketsPerBuyer) document.getElementById('maxTickets').value = event.maxTicketsPerBuyer;
            if(event.maxResaleMarkup !== undefined) document.getElementById('maxResaleMarkup').value = event.maxResaleMarkup;
            if(event.resaleStartDate) document.getElementById('resaleStart').value = event.resaleStartDate;
            if(event.resaleDeadline) document.getElementById('resaleEnd').value = event.resaleDeadline;
            
            if(event.transferEnabled !== undefined) document.getElementById('transferEnabled').checked = event.transferEnabled;
            if(event.resaleEnabled !== undefined) document.getElementById('resaleEnabled').checked = event.resaleEnabled;
        }
        
        document.getElementById('add-cat-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const form = document.querySelector('.ts-auth-fields');
            V.clearFieldErrors(form);
            const ok = V.runAll([
                { check: () => V.validateRequired(V.val(form, 'catName'), 'Name'), el: V.el(form, 'catName') },
                { check: () => V.validateRequired(V.val(form, 'catSection'), 'Section'), el: V.el(form, 'catSection') },
                { check: () => V.validatePrice(V.val(form, 'catPrice'), 'Price'), el: V.el(form, 'catPrice') },
                { check: () => V.validateQuantity(V.val(form, 'catQuantity'), 'Quantity'), el: V.el(form, 'catQuantity') }
            ]);
            if(!ok) return;
            
            const newCat = {
                name: V.val(form, 'catName'),
                section: V.val(form, 'catSection'),
                price: parseFloat(V.val(form, 'catPrice')),
                quantity: parseInt(V.val(form, 'catQuantity'))
            };

            // Validation 1: Prevent duplicate mapping
            const isSectionUsed = existingCats.some(c => c.section === newCat.section);
            if (isSectionUsed) {
                alert('This physical section is already mapped to another category. Each section can only be mapped to one ticket category.');
                return;
            }

            // Validation 2: Prevent exceeding physical capacity
            const vSec = venueSections.find(vs => vs.name === newCat.section);
            const capacity = vSec ? parseInt(vSec.seatCount) || 0 : 0;
            if (newCat.quantity > capacity) {
                alert(`Cannot add category: The quantity (${newCat.quantity}) exceeds the physical capacity of ${newCat.section} (${capacity} seats).`);
                return;
            }

            const updatedCats = [...existingCats, newCat];
            const addBtn = document.getElementById('add-cat-btn');
            addBtn.disabled = true; addBtn.textContent = 'Saving...';
            await window.tsEvents.updateCategories(eventId, updatedCats);
            window.location.reload();
        });
        
        document.getElementById('confirm-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmBtn = document.getElementById('confirm-btn');
            
            // 1. Check if all physical sections have been mapped
            const unmappedSections = venueSections.filter(vs => !existingCats.some(c => c.section === vs.name));
            if (unmappedSections.length > 0) {
                alert(`Cannot submit: You have unmapped venue sections (${unmappedSections.map(s => s.name).join(', ')}). You must map a ticket category to every section.`);
                return;
            }

            // 2. Validate all rules fields
            V.clearFieldErrors(rulesForm);
            const ok = V.runAll([
                { check: () => V.validateRequired(V.val(rulesForm, 'salesStart'), 'Sales Start Date'), el: V.el(rulesForm, 'salesStart') },
                { check: () => V.validateRequired(V.val(rulesForm, 'salesEnd'), 'Sales Closing Date'), el: V.el(rulesForm, 'salesEnd') },
                { check: () => V.validateRequired(V.val(rulesForm, 'maxTickets'), 'Max Tickets per Buyer'), el: V.el(rulesForm, 'maxTickets') },
                { check: () => V.validateRequired(V.val(rulesForm, 'maxResaleMarkup'), 'Max Resale Markup'), el: V.el(rulesForm, 'maxResaleMarkup') },
                { check: () => V.validateRequired(V.val(rulesForm, 'resaleStart'), 'Resale Start Date'), el: V.el(rulesForm, 'resaleStart') },
                { check: () => V.validateRequired(V.val(rulesForm, 'resaleEnd'), 'Resale Deadline'), el: V.el(rulesForm, 'resaleEnd') }
            ]);
            
            if (!ok) {
                alert('Please fill out all the Sales, Transfer & Resale Rules fields before submitting.');
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Submitting...';

            try {
                // Save rules
                await window.tsEvents.updateEvent(eventId, {
                    salesStartDate: V.val(rulesForm, 'salesStart'),
                    salesEndDate: V.val(rulesForm, 'salesEnd'),
                    maxTicketsPerBuyer: parseInt(V.val(rulesForm, 'maxTickets')) || 4,
                    maxResaleMarkup: parseFloat(V.val(rulesForm, 'maxResaleMarkup')) || 0,
                    resaleStartDate: V.val(rulesForm, 'resaleStart'),
                    resaleDeadline: V.val(rulesForm, 'resaleEnd'),
                    transferEnabled: document.getElementById('transferEnabled').checked,
                    resaleEnabled: document.getElementById('resaleEnabled').checked
                });
                
                // Submit for approval (changes status to PENDING)
                await window.tsEvents.submitForApproval(eventId);
                alert('Event successfully submitted for Administrator approval!');
                window.location.href = 'events.php';
            } catch (err) {
                console.error('Failed to submit:', err);
                alert('Error submitting event: ' + err.message);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Submit for Approval';
            }
        });
        
    } catch(err) {
        console.error('Error loading config:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Ticket Configuration', 'events', $content, '..', '');
?>