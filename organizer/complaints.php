<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Complaints & Disputes', 'Submit and track support cases for your organization. Investigation and resolution actions remain administrator-controlled.', '<button class="ts-btn ts-btn-primary" id="open-complaint-modal" type="button">New Complaint</button>')?>
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
                </tr>
            </thead>
            <tbody id="complaints-tbody">
                <tr><td colspan="5" class="text-center">Loading...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div class="ts-modal" id="new-complaint-modal" aria-hidden="true" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
    <div class="ts-card ts-card-pad" role="dialog" aria-modal="true" aria-labelledby="new-complaint-title" style="width:480px; max-width:90%">
        <div class="flex justify-between items-center">
            <div class="ts-card-title" id="new-complaint-title">New Complaint</div>
            <button class="ts-icon-btn" type="button" id="close-modal-icon" aria-label="Close"><?=ts_icon('x')?></button>
        </div>
        <form id="complaint-form" class="mt-20">
            <div class="ts-field">
                <label class="ts-label" for="comp-category">Category</label>
                <select class="ts-select" id="comp-category" required>
                    <option value="">Select a category</option>
                    <option value="Event setup">Event setup</option>
                    <option value="Venue or seating">Venue or seating</option>
                    <option value="Attendee or ticket">Attendee or ticket</option>
                    <option value="Sales or payout">Sales or payout</option>
                    <option value="Account or access">Account or access</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="ts-field mt-12">
                <label class="ts-label" for="comp-desc">Description</label>
                <textarea class="ts-textarea" id="comp-desc" required minlength="10" maxlength="5000" placeholder="Describe the issue, relevant event or booking details, and the outcome you need."></textarea>
            </div>
            <div class="ts-field mt-12">
                <label class="ts-label" for="comp-evidence">Supporting evidence <span class="secondary">(optional)</span></label>
                <input class="ts-input" id="comp-evidence" type="file" accept="image/jpeg,image/png,application/pdf">
                <div class="small secondary mt-8">JPG, PNG, or PDF; maximum 10 MB.</div>
            </div>
            <p class="small" id="complaint-error" role="alert" hidden></p>
            <div class="flex justify-end gap-12 mt-20">
                <button type="button" class="ts-btn ts-btn-secondary" id="close-modal-btn">Cancel</button>
                <button type="submit" class="ts-btn ts-btn-primary" id="submit-complaint-btn">Submit</button>
            </div>
        </form>
    </div>
</div>

<script type="module">
const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const dateText = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '&mdash;' : date.toLocaleDateString();
};

const statusDisplay = (status) => {
    const normalized = String(status || 'OPEN').toUpperCase();
    const labels = {
        OPEN: ['info', 'Open'],
        UNDER_INVESTIGATION: ['warning', 'Under Investigation'],
        RESOLVED: ['success', 'Resolved'],
        REJECTED: ['error', 'Rejected']
    };
    return labels[normalized] || ['neutral', normalized.replace(/_/g, ' ')];
};

const modal = document.getElementById('new-complaint-modal');
const form = document.getElementById('complaint-form');
const errorMessage = document.getElementById('complaint-error');
const submitButton = document.getElementById('submit-complaint-btn');
let initialized = false;

const closeModal = () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    errorMessage.hidden = true;
};

const openModal = () => {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('comp-category').focus();
};

document.getElementById('open-complaint-modal')?.addEventListener('click', openModal);
document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
document.getElementById('close-modal-icon')?.addEventListener('click', closeModal);
modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
});

async function loadComplaints() {
    const tbody = document.getElementById('complaints-tbody');
    const complaints = await window.tsComplaints.getUserComplaints();
    tbody.innerHTML = complaints.map((complaint) => {
        const [tone, label] = statusDisplay(complaint.status);
        return `<tr>
            <td class="cell-title">${esc(complaint.referenceNumber || complaint.id)}</td>
            <td>${esc(complaint.category || 'Other')}</td>
            <td>${dateText(complaint.createdAt)}</td>
            <td><span class="ts-chip ts-chip-${tone}">${esc(label)}</span></td>
            <td>${dateText(complaint.updatedAt || complaint.createdAt)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-center">No complaints found.</td></tr>';
}

async function initialize() {
    if (initialized || !window.tsCurrentUser?.uid || !window.tsComplaints) return;
    initialized = true;
    try {
        await loadComplaints();
    } catch (error) {
        console.error('Failed to load complaints', error);
        document.getElementById('complaints-tbody').innerHTML = '<tr><td colspan="5" class="text-center">Unable to load complaints. Please refresh and try again.</td></tr>';
    }
}

window.addEventListener('ts-auth-ready', initialize);
if (window.tsCurrentUser?.uid) initialize();

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const category = document.getElementById('comp-category').value;
    const description = document.getElementById('comp-desc').value.trim();
    const evidenceFile = document.getElementById('comp-evidence').files?.[0] || null;
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

    errorMessage.hidden = true;
    if (evidenceFile && (!allowedTypes.includes(evidenceFile.type) || evidenceFile.size > 10 * 1024 * 1024)) {
        errorMessage.textContent = 'Evidence must be a JPG, PNG, or PDF file no larger than 10 MB.';
        errorMessage.hidden = false;
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    try {
        await window.tsComplaints.createComplaint({ category, description, evidenceFile });
        form.reset();
        closeModal();
        await loadComplaints();
    } catch (error) {
        console.error('Failed to create complaint', error);
        errorMessage.textContent = error.message || 'Unable to submit the complaint. Please try again.';
        errorMessage.hidden = false;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Complaints', 'complaints', $content, '..', '');
?>
