<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Venue Management', 'Create physical venues, upload seating blueprints and activate processed layouts for Organizer event configuration.', '<a class="ts-btn ts-btn-primary" href="venue-new.php">'.ts_icon('plus').' Add Venue</a>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Search venue or address"></div><select class="ts-select">
            <option>All layout status</option>
            <option>Active</option>
            <option>Processing</option>
            <option>Draft</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Venue</th>
                    <th>Address</th>
                    <th>Capacity</th>
                    <th>Layout Status</th>
                    <th>Detected Sections</th>
                    <th>Last Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="venue-table-body">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const loadVenues = async () => {
        try {
            const venues = await window.tsVenues.getVenues();
            const tbody = document.getElementById('venue-table-body');
            if (!tbody) return;
            if (venues.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center secondary" style="padding:40px">No items found.</td></tr>';
                return;
            }
            
            const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
            
            tbody.innerHTML = venues.map(v => {
                const layoutStatus = (v.layoutStatus || 'DRAFT').toUpperCase();
                let tone = 'neutral';
                if (layoutStatus === 'ACTIVE') tone = 'success';
                else if (layoutStatus === 'PROCESSING') tone = 'purple';

                return `
                    <tr>
                        <td class="cell-title">${esc(v.name)}</td>
                        <td>${esc(v.address)}</td>
                        <td>${esc(v.capacity)}</td>
                        <td><span class="ts-chip ts-chip-${tone}">${esc(layoutStatus)}</span></td>
                        <td>${Array.isArray(v.sections) ? v.sections.length : 0}</td>
                        <td>${new Date(v.updatedAt || v.createdAt).toLocaleDateString()}</td>
                        <td>
                            <a class="ts-btn ts-btn-secondary ts-btn-sm" href="venue-detail.php?id=${v.id}">Manage</a>
                            <button class="ts-btn ts-btn-secondary ts-btn-sm text-error delete-btn" data-id="${v.id}">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Wire up delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Are you sure you want to delete this venue?')) {
                        try {
                            btn.disabled = true;
                            btn.textContent = '...';
                            await window.tsVenues.deleteVenue(btn.dataset.id);
                            await loadVenues();
                        } catch (err) {
                            console.error('Delete error', err);
                            alert(err.message);
                            btn.disabled = false;
                            btn.textContent = 'Delete';
                        }
                    }
                });
            });
            
        } catch (err) {
            console.error('Load error:', err);
        }
    };
    
    await loadVenues();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Venues & Layouts', 'venues', $content, '..', '');
?>
