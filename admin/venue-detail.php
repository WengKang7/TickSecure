<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<button id="btn-edit" class="ts-btn ts-btn-secondary" style="display:none;">Edit Venue</button> <button id="btn-layout" class="ts-btn ts-btn-primary" style="display:none;">'.ts_icon('layout').' Open Seating Layout</button>')?>
<div id="venue-detail-container" style="display:none;">
    <div class="ts-grid-3">
        <div class="ts-card ts-card-pad">
            <div class="ts-detail-label">Layout Status</div>
            <div class="mt-12" id="val-status"></div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-detail-label">Confirmed Sections</div>
            <div class="ts-kpi-value" id="val-sections-count">0</div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-detail-label">Generated Seats</div>
            <div class="ts-kpi-value" id="val-seats-count">0</div>
        </div>
    </div>
    <div class="ts-card mt-24">
        <div class="ts-card-head">
            <div>
                <div class="ts-card-title">Physical Venue Sections</div>
                <div class="ts-card-sub">Reusable across events; Organizer maps event-specific ticket categories later.</div>
            </div>
        </div>
        <div class="ts-table-wrap">
            <table class="ts-table">
                <thead>
                    <tr>
                        <th>Section</th>
                        <th>Total Seats</th>
                        <th>Assignment Order</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="sections-table-body">
                    <tr><td colspan="4" class="text-center secondary">No sections defined</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Modal: View Seating Layout -->
<div class="ts-modal-backdrop" id="layout-modal" style="display:none; align-items:center; justify-content:center;">
    <div class="ts-modal" style="width: 800px; max-width: 90vw;">
        <div class="ts-modal-head">
            <div class="ts-modal-title">Seating Layout Preview</div>
            <button class="ts-btn ts-btn-secondary" onclick="document.getElementById('layout-modal').style.display='none'">Close</button>
        </div>
        <div class="ts-modal-body mt-20">
            <div id="preview-venue-board" class="ts-reusable-venue-plan" style="border-radius: 8px;"></div>
            <p class="small muted mt-12 text-center">This layout is currently view-only. To make changes, use the Edit Venue menu.</p>
        </div>
    </div>
</div>

<!-- Modal: Edit Venue -->
<div class="ts-modal-backdrop" id="edit-modal" style="display:none; align-items:center; justify-content:center;">
    <div class="ts-modal" style="width: 500px; max-width: 90vw;">
        <div class="ts-modal-head">
            <div class="ts-modal-title">Edit Venue Details</div>
            <button class="ts-btn ts-btn-secondary" onclick="document.getElementById('edit-modal').style.display='none'">Cancel</button>
        </div>
        <div class="ts-modal-body mt-20">
            <div class="ts-form-group">
                <label>Venue Name</label>
                <input type="text" class="ts-input" id="edit-name">
            </div>
            <div class="ts-form-group mt-16">
                <label>Address</label>
                <textarea class="ts-input" id="edit-address" rows="3"></textarea>
            </div>
            <div class="ts-form-group mt-16">
                <label>Total Capacity</label>
                <input type="number" class="ts-input" id="edit-capacity">
            </div>
            
            <div class="mt-24 pt-20" style="border-top: 1px solid var(--border-default);">
                <label style="display:block; margin-bottom:8px; font-weight:600;">Seating Layout & Blueprint</label>
                <p class="small muted mb-12">Need to change the physical seating sections or upload a new blueprint?</p>
                <a href="#" id="edit-layout-link" class="ts-btn ts-btn-secondary" style="width: 100%; justify-content:center;"><?=ts_icon('layout')?> Edit Blueprint & Sections</a>
            </div>

            <div class="mt-24 flex" style="gap: 12px; justify-content: flex-end;">
                <button class="ts-btn ts-btn-primary" id="btn-save-edit">Save Details</button>
            </div>
        </div>
    </div>
</div>

<script src="../assets/js/venue-renderer.js"></script>
<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('id');
    
    if (!venueId) {
        document.querySelector('.ts-page-title').textContent = 'Venue not found';
        return;
    }

    const loadVenue = async () => {
        try {
            const venue = await window.tsVenues.getVenue(venueId);
            if (!venue) throw new Error('Venue not found');
            
            document.getElementById('venue-detail-container').style.display = 'block';
            document.querySelector('.ts-page-title').textContent = venue.name;
            document.querySelector('.ts-page-subtitle').textContent = `Added on ${new Date(venue.createdAt).toLocaleDateString()}`;
            
            // Wire View Layout button
            const btnLayout = document.getElementById('btn-layout');
            btnLayout.style.display = 'inline-flex';
            btnLayout.onclick = () => {
                document.getElementById('layout-modal').style.display = 'flex';
                
                // Render the board
                const secs = Array.isArray(venue.sections) ? venue.sections : [];
                const rendererSections = secs.map(s => ({
                    id: 'sec-' + s.sectionId,
                    name: s.name,
                    letter: s.sectionId,
                    seats: parseInt(s.seatCount, 10) || 0
                }));
                
                // Render if there are sections, otherwise show a message inside the board container
                const boardContainer = document.getElementById('preview-venue-board');
                if (rendererSections.length > 0) {
                    boardContainer.innerHTML = ''; // clear previous
                    if (window.tsVenueRenderer) {
                        window.tsVenueRenderer.renderBoard('preview-venue-board', rendererSections);
                    }
                } else {
                    boardContainer.innerHTML = '<div class="ts-reusable-venue-plan" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">No sections defined yet.</div>';
                }
            };

            // Wire Edit Venue button
            const btnEdit = document.getElementById('btn-edit');
            btnEdit.style.display = 'inline-flex';
            btnEdit.onclick = () => {
                document.getElementById('edit-name').value = venue.name || '';
                document.getElementById('edit-address').value = venue.address || '';
                document.getElementById('edit-capacity').value = venue.capacity || '';
                document.getElementById('edit-layout-link').href = `venue-layout.php?id=${venueId}`;
                document.getElementById('edit-modal').style.display = 'flex';
            };
            
            // Wire Save Details button
            document.getElementById('btn-save-edit').onclick = async () => {
                const btnSave = document.getElementById('btn-save-edit');
                const oldText = btnSave.textContent;
                btnSave.textContent = 'Saving...';
                btnSave.style.pointerEvents = 'none';
                
                try {
                    await window.tsVenues.updateVenue(venueId, {
                        name: document.getElementById('edit-name').value.trim(),
                        address: document.getElementById('edit-address').value.trim(),
                        capacity: parseInt(document.getElementById('edit-capacity').value, 10) || 0
                    });
                    document.getElementById('edit-modal').style.display = 'none';
                    await loadVenue();
                } catch (err) {
                    console.error(err);
                    alert('Failed to save venue details.');
                } finally {
                    btnSave.textContent = oldText;
                    btnSave.style.pointerEvents = 'auto';
                }
            };

            let layoutStatus = venue.layoutStatus || 'DRAFT';
            let tone = layoutStatus === 'ACTIVE' ? 'success' : (layoutStatus === 'PROCESSING' ? 'purple' : 'neutral');
            document.getElementById('val-status').innerHTML = `<span class="ts-chip ts-chip-${tone}">${layoutStatus.toLowerCase()}</span>`;
            
            const sections = Array.isArray(venue.sections) ? venue.sections : [];
            document.getElementById('val-sections-count').textContent = sections.length;
            
            let totalSeats = 0;
            sections.forEach(sec => { totalSeats += (parseInt(sec.seatCount, 10) || 0); });
            document.getElementById('val-seats-count').textContent = totalSeats;
            
            const tbody = document.getElementById('sections-table-body');
            if (sections.length > 0) {
                tbody.innerHTML = sections.map(sec => {
                    const count = parseInt(sec.seatCount, 10) || 0;
                    const prefix = sec.sectionId || 'Seat';
                    return `
                        <tr>
                            <td class="cell-title">${sec.name}</td>
                            <td>${count}</td>
                            <td>${prefix}01 &rarr; ${prefix}${String(count).padStart(2, '0')}</td>
                            <td><span class="ts-chip ts-chip-success">Active</span></td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center secondary">No sections defined</td></tr>';
            }

        } catch (err) {
            console.error(err);
            document.querySelector('.ts-page-title').textContent = 'Error loading venue';
        }
    };
    
    await loadVenue();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Venue Details', 'venues', $content, '..', '');
?>