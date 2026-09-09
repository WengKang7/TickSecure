<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Complaints & Disputes', 'Submit and track complaints raised by your organization. Administrator investigation details remain role-restricted.', '<button class="ts-btn ts-btn-primary" data-modal-open="confirm-modal">New Complaint</button>')?>
<div class="ts-card">
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="complaints-tbody">
                <tr><td colspan="6" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div class="ts-modal" id="new-complaint-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
    <div class="ts-card ts-card-pad" style="width:400px; max-width:90%">
        <div class="ts-card-title">New Complaint</div>
        <form id="complaint-form" class="mt-20">
            <div class="ts-field">
                <label class="ts-label">Subject</label>
                <input class="ts-input" id="comp-subject" name="comp-subject" required>
            </div>
            <div class="ts-field mt-12">
                <label class="ts-label">Description</label>
                <textarea class="ts-textarea" id="comp-desc" name="comp-desc" required></textarea>
            </div>
            <div class="flex justify-end gap-12 mt-20">
                <button type="button" class="ts-btn ts-btn-secondary" id="close-modal-btn">Cancel</button>
                <button type="submit" class="ts-btn ts-btn-primary" id="submit-complaint-btn">Submit</button>
            </div>
        </form>
    </div>
</div>

<script type="module">
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const complaints = await window.tsComplaints.getUserComplaints();
        const tbody = document.getElementById('complaints-tbody');
        if(tbody) {
            tbody.innerHTML = complaints.map(c => {
                const tone = c.status === 'RESOLVED' ? 'success' : (c.status === 'REJECTED' ? 'error' : 'warning');
                return `
                <tr>
                    <td class="cell-title">${esc(c.id)}</td>
                    <td>${esc(c.subject || 'General')}</td>
                    <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                    <td><span class="ts-chip ts-chip-${tone}">${esc(c.status || 'PENDING')}</span></td>
                    <td>${new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</td>
                    <td><button class="ts-btn ts-btn-secondary ts-btn-sm">View</button></td>
                </tr>
                `;
            }).join('') || '<tr><td colspan="6" class="text-center">No complaints found.</td></tr>';
        }

        const modal = document.getElementById('new-complaint-modal');
        const openBtn = document.querySelector('[data-modal-open="confirm-modal"]');
        if(openBtn) {
            openBtn.removeAttribute('data-modal-open');
            openBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
        }
        
        document.getElementById('close-modal-btn')?.addEventListener('click', () => { modal.style.display = 'none'; });
        
        document.getElementById('complaint-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const subject = document.getElementById('comp-subject').value;
            const desc = document.getElementById('comp-desc').value;
            const submitBtn = document.getElementById('submit-complaint-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            try {
                await window.tsComplaints.createComplaint({ subject, description: desc });
                window.location.reload();
            } catch(err) {
                console.error(err);
                alert('Error creating complaint');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });

    } catch(e) { console.error('Failed to load complaints', e); }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Complaints', 'complaints', $content, '..', '');
?>