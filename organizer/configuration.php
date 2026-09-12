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
            <div class="ts-field"><label class="ts-label">Category Name</label><input class="ts-input" id="catName" name="catName" maxlength="80" value="">
            </div>
            <div class="ts-field"><label class="ts-label">Physical Venue Section</label><select class="ts-select" id="catSection" name="catSection">
                    <option value="">Select Section...</option>
                </select></div>
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label">Ticket Price (RM)</label><input class="ts-input" type="number" id="catPrice" name="catPrice" min="1" max="99999" step="0.01"
                        value=""></div>
                <div class="ts-field"><label class="ts-label">Ticket Quantity</label><input class="ts-input" type="number" id="catQuantity" name="catQuantity" min="1" step="1" value="">
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
        <div class="ts-field"><label class="ts-label">Maximum Tickets per Buyer</label><input class="ts-input" type="number" min="1" step="1"
                id="maxTickets" name="maxTickets"></div>
        <div class="ts-field"><label class="ts-label">Maximum Resale Markup (%)</label><input class="ts-input" type="number"
                id="maxResaleMarkup" name="maxResaleMarkup" min="0" max="100" step="0.01" value="5"></div>
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
                    `<option value="${esc(s.sectionId)}">${esc(s.name)} (Section ${esc(s.sectionId)}) · ${s.seatCount} seats</option>`
                ).join('');
            }
        }
        
        let existingCats = Array.isArray(event.categories)
            ? event.categories.map(c => ({ ...c, sectionId: c.sectionId || c.section || c.id || '' }))
            : Object.entries(event.categories || {}).map(([sectionId, c]) => ({ ...c, sectionId }));

        const tbody = document.getElementById('categories-tbody');
        if (tbody) {
            tbody.innerHTML = existingCats.map((c, i) => {
                // Capacity check logic
                const vSec = venueSections.find(vs => vs.sectionId === c.sectionId);
                const capacity = vSec ? parseInt(vSec.seatCount) || 0 : 0;
                const isOver = c.quantity > capacity;
                const checkChip = isOver ? '<span class="ts-chip ts-chip-danger">Over Capacity</span>' : '<span class="ts-chip ts-chip-success">Valid</span>';

                return `
                <tr>
                    <td class="cell-title">${esc(c.name)}</td>
                    <td>${esc(vSec?.name || c.sectionId)} <span class="small muted">(${esc(c.sectionId)})</span></td>
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
        const categoryForm = document.querySelector('.ts-auth-fields');
        const wholeNumber = value => /^\d+$/.test(String(value ?? '').trim());
        const validMoney = value => /^\d+(?:\.\d{1,2})?$/.test(String(value ?? '').trim());
        const toLocalDateTime = value => {
            const raw = String(value || '').trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) return '';
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        };
        const eventStart = () => {
            const date = String(event.date || '').trim();
            const time = String(event.time || '23:59').trim();
            const parsed = new Date(`${date}T${time}`);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const categoryCapacity = sectionId => {
            const section = venueSections.find(item => String(item.sectionId) === String(sectionId));
            return Number(section?.seatCount ?? section?.seats ?? 0);
        };
        const validateConfiguredCategories = () => {
            if (!existingCats.length) return 'Add at least one ticket category before submitting the event.';

            const mappedSections = new Set();
            const categoryNames = new Set();
            for (const category of existingCats) {
                const name = String(category.name || '').trim();
                const sectionId = String(category.sectionId || '').trim();
                const price = String(category.price ?? '').trim();
                const quantity = String(category.quantity ?? '').trim();
                const nameKey = name.toLocaleLowerCase();

                if (name.length < 2 || name.length > 80) return 'Each category name must be between 2 and 80 characters.';
                if (!sectionId || !Number.isFinite(categoryCapacity(sectionId)) || categoryCapacity(sectionId) < 1) {
                    return `Category “${name || 'Unnamed'}” is not mapped to a valid venue section.`;
                }
                if (mappedSections.has(sectionId)) return `Section ${sectionId} is mapped to more than one ticket category.`;
                if (categoryNames.has(nameKey)) return `Ticket category name “${name}” is duplicated.`;
                if (!validMoney(price) || !V.validatePrice(price, 1, 99999).valid) {
                    return `Category “${name}” must have a price from RM 1.00 to RM 99,999.00 with no more than two decimal places.`;
                }
                if (!wholeNumber(quantity) || !V.validateQuantity(quantity, 1, Math.floor(categoryCapacity(sectionId))).valid) {
                    return `Category “${name}” must have a whole-ticket quantity within its physical section capacity.`;
                }
                mappedSections.add(sectionId);
                categoryNames.add(nameKey);
            }
            return '';
        };

        const validateRules = () => {
            V.clearFieldErrors(rulesForm);
            const salesStart = V.val(rulesForm, 'salesStart');
            const salesEnd = V.val(rulesForm, 'salesEnd');
            const resaleEnabled = document.getElementById('resaleEnabled').checked;
            const resaleStart = V.val(rulesForm, 'resaleStart');
            const resaleEnd = V.val(rulesForm, 'resaleEnd');
            const totalTickets = existingCats.reduce((total, category) => total + (Number(category.quantity) || 0), 0);
            const startsAt = eventStart();
            const rules = [
                {
                    check: () => {
                        const required = V.validateRequired(salesStart, 'Sales Start Date');
                        if (!required.valid) return required;
                        const start = new Date(salesStart);
                        if (Number.isNaN(start.getTime())) return { valid: false, error: 'Sales Start Date is invalid.' };
                        if (start.getTime() <= Date.now()) return { valid: false, error: 'Sales must start in the future.' };
                        if (startsAt && start >= startsAt) return { valid: false, error: 'Sales must start before the event begins.' };
                        return { valid: true };
                    },
                    el: V.el(rulesForm, 'salesStart')
                },
                {
                    check: () => {
                        const required = V.validateRequired(salesEnd, 'Sales Closing Date');
                        if (!required.valid) return required;
                        const range = V.validateDateRange(salesStart, salesEnd);
                        if (!range.valid) return range;
                        const end = new Date(salesEnd);
                        if (startsAt && end > startsAt) return { valid: false, error: 'Sales must close on or before the event start.' };
                        return { valid: true };
                    },
                    el: V.el(rulesForm, 'salesEnd')
                },
                {
                    check: () => {
                        const value = V.val(rulesForm, 'maxTickets');
                        const required = V.validateRequired(value, 'Maximum Tickets per Buyer');
                        if (!required.valid) return required;
                        if (!wholeNumber(value)) return { valid: false, error: 'Maximum tickets per buyer must be a whole number.' };
                        if (!totalTickets) return { valid: false, error: 'Add valid ticket categories before setting a buyer limit.' };
                        return V.validateQuantity(value, 1, totalTickets);
                    },
                    el: V.el(rulesForm, 'maxTickets')
                }
            ];

            if (resaleEnabled) {
                rules.push(
                    {
                        check: () => {
                            const value = V.val(rulesForm, 'maxResaleMarkup');
                            const required = V.validateRequired(value, 'Maximum Resale Markup');
                            if (!required.valid) return required;
                            if (!validMoney(value)) return { valid: false, error: 'Maximum resale markup must use no more than two decimal places.' };
                            const markup = Number(value);
                            return markup >= 0 && markup <= 100
                                ? { valid: true }
                                : { valid: false, error: 'Maximum resale markup must be between 0% and 100%.' };
                        },
                        el: V.el(rulesForm, 'maxResaleMarkup')
                    },
                    {
                        check: () => {
                            const required = V.validateRequired(resaleStart, 'Resale Start Date');
                            if (!required.valid) return required;
                            const start = new Date(resaleStart);
                            if (Number.isNaN(start.getTime())) return { valid: false, error: 'Resale Start Date is invalid.' };
                            if (start < new Date(salesStart)) return { valid: false, error: 'Resale cannot start before ticket sales open.' };
                            if (startsAt && start >= startsAt) return { valid: false, error: 'Resale must start before the event begins.' };
                            return { valid: true };
                        },
                        el: V.el(rulesForm, 'resaleStart')
                    },
                    {
                        check: () => {
                            const required = V.validateRequired(resaleEnd, 'Resale Deadline');
                            if (!required.valid) return required;
                            const range = V.validateDateRange(resaleStart, resaleEnd);
                            if (!range.valid) return range;
                            const end = new Date(resaleEnd);
                            if (startsAt && end > startsAt) return { valid: false, error: 'Resale must end on or before the event start.' };
                            return { valid: true };
                        },
                        el: V.el(rulesForm, 'resaleEnd')
                    }
                );
            }

            const ok = V.runAll(rules);
            if (!ok) V.showGlobalError(rulesForm, 'Check sales and resale rules', 'Correct the highlighted fields before submitting the event.');
            return ok;
        };

        if (rulesForm) {
            if(event.salesStartDate) document.getElementById('salesStart').value = toLocalDateTime(event.salesStartDate);
            if(event.salesEndDate) document.getElementById('salesEnd').value = toLocalDateTime(event.salesEndDate);
            if(event.maxTicketsPerBuyer) document.getElementById('maxTickets').value = event.maxTicketsPerBuyer;
            if(event.maxResaleMarkup !== undefined) document.getElementById('maxResaleMarkup').value = event.maxResaleMarkup;
            if(event.resaleStartDate) document.getElementById('resaleStart').value = toLocalDateTime(event.resaleStartDate);
            if(event.resaleDeadline) document.getElementById('resaleEnd').value = toLocalDateTime(event.resaleDeadline);
            
            if(event.transferEnabled !== undefined) document.getElementById('transferEnabled').checked = event.transferEnabled;
            if(event.resaleEnabled !== undefined) document.getElementById('resaleEnabled').checked = event.resaleEnabled;
        }
        
        document.getElementById('add-cat-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const form = categoryForm;
            V.clearFieldErrors(form);
            const categoryName = V.val(form, 'catName');
            const categorySection = V.val(form, 'catSection');
            const categoryPrice = V.val(form, 'catPrice');
            const categoryQuantity = V.val(form, 'catQuantity');
            const capacity = categoryCapacity(categorySection);
            const ok = V.runAll([
                {
                    check: () => {
                        let result = V.validateRequired(categoryName, 'Category Name');
                        if (!result.valid) return result;
                        result = V.validateMinLength(categoryName, 2, 'Category Name');
                        if (!result.valid) return result;
                        return V.validateMaxLength(categoryName, 80, 'Category Name');
                    },
                    el: V.el(form, 'catName')
                },
                {
                    check: () => {
                        const result = V.validateSelect(categorySection, 'physical venue section');
                        if (!result.valid) return result;
                        return capacity > 0
                            ? { valid: true }
                            : { valid: false, error: 'Choose a valid section with a positive seating capacity.' };
                    },
                    el: V.el(form, 'catSection')
                },
                {
                    check: () => {
                        if (!validMoney(categoryPrice)) return { valid: false, error: 'Ticket Price must use no more than two decimal places.' };
                        return V.validatePrice(categoryPrice, 1, 99999);
                    },
                    el: V.el(form, 'catPrice')
                },
                {
                    check: () => {
                        if (!wholeNumber(categoryQuantity)) return { valid: false, error: 'Ticket Quantity must be a whole number.' };
                        return V.validateQuantity(categoryQuantity, 1, Math.max(1, Math.floor(capacity)));
                    },
                    el: V.el(form, 'catQuantity')
                }
            ]);
            if(!ok) {
                V.showGlobalError(form, 'Check the ticket category', 'Correct the highlighted fields before adding this category.');
                return;
            }
            
            const newCat = {
                name: categoryName,
                sectionId: categorySection,
                price: Number(categoryPrice),
                quantity: Number(categoryQuantity)
            };

            // Validation 1: Prevent duplicate mapping
            const isSectionUsed = existingCats.some(c => c.sectionId === newCat.sectionId);
            if (isSectionUsed) {
                V.showFieldError(V.el(form, 'catSection'), 'This physical section is already mapped to another category.');
                V.showGlobalError(form, 'Check the ticket category', 'Each physical section can only be mapped to one ticket category.');
                return;
            }

            if (existingCats.some(category => String(category.name || '').trim().toLocaleLowerCase() === newCat.name.toLocaleLowerCase())) {
                V.showFieldError(V.el(form, 'catName'), 'Ticket category names must be unique for this event.');
                V.showGlobalError(form, 'Check the ticket category', 'Use a distinct category name so buyers can identify ticket types clearly.');
                return;
            }

            // Validation 2: Prevent exceeding physical capacity
            const vSec = venueSections.find(vs => vs.sectionId === newCat.sectionId);
            const capacity = vSec ? parseInt(vSec.seatCount) || 0 : 0;
            if (newCat.quantity > capacity) {
                V.showFieldError(V.el(form, 'catQuantity'), `The quantity cannot exceed ${capacity} seats in this physical section.`);
                V.showGlobalError(form, 'Check the ticket category', `The selected section has a capacity of ${capacity} seats.`);
                return;
            }

            const updatedCats = [...existingCats, newCat];
            const addBtn = document.getElementById('add-cat-btn');
            addBtn.disabled = true;
            addBtn.textContent = 'Saving...';
            try {
                await window.tsEvents.updateCategories(eventId, updatedCats);
                window.location.reload();
            } catch (error) {
                console.error('Unable to add ticket category:', error);
                V.showGlobalError(form, 'Category was not saved', error?.message || 'Please try again.');
                addBtn.disabled = false;
                addBtn.textContent = 'Add Category';
            }
        });
        
        document.getElementById('confirm-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmBtn = document.getElementById('confirm-btn');
            
            // 1. Check if all physical sections have been mapped
            const unmappedSections = venueSections.filter(vs => !existingCats.some(c => c.sectionId === vs.sectionId));
            if (unmappedSections.length > 0) {
                alert(`Cannot submit: You have unmapped venue sections (${unmappedSections.map(s => s.name).join(', ')}). You must map a ticket category to every section.`);
                return;
            }

            const categoriesError = validateConfiguredCategories();
            if (categoriesError) {
                V.showGlobalError(categoryForm, 'Ticket configuration is incomplete', categoriesError);
                document.getElementById('categories-tbody')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // 2. Validate sales, transfer, and resale rules in relation to the event time.
            if (!validateRules()) {
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
