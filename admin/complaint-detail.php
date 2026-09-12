<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<div id="action-buttons" style="display:none;"><button id="btn-investigate" class="ts-btn ts-btn-secondary">Investigate</button> <button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button> <button id="btn-resolve" class="ts-btn ts-btn-success">Resolve</button></div>')?>
<div class="ts-content-grid" id="cmp-detail-container" style="display:none;">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="flex justify-between">
                <div class="ts-card-title">Complaint Description</div>
                <div id="val-status"></div>
            </div>
            <p class="secondary" id="val-desc"></p>
            <div class="ts-divider"></div>
            <div class="ts-card-title">Evidence</div>
            <div class="ts-list" id="evidence-list">
                <div class="text-center secondary">No evidence provided</div>
            </div>
        </div>
        <div class="ts-card ts-card-pad mt-20">
            <div class="ts-card-title">Status Timeline</div>
            <div class="ts-timeline mt-20" id="val-timeline">
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Related Records</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Booking / Resale</div>
                <div class="ts-detail-value" id="val-related">N/A</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Payment</div>
                <div class="ts-detail-value">
                    <span class="ts-chip ts-chip-success">Successful</span>
                    N/A</div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">NFT Ticket</div>
                <div class="ts-detail-value ts-wallet-id">0x81A3…30F2</div>
            </div>
        </div>
    </aside>
</div>

<script type="module">
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeEvidenceUrl = value => {
    try {
        const parsed = new URL(String(value || ''));
        if (parsed.protocol === 'https:' && parsed.hostname === 'firebasestorage.googleapis.com') {
            return parsed.href;
        }
    } catch (_) {
        // Fall through to the strict local FYP-path allow-list below.
    }

    const localPath = String(value || '');
    const backend = window.tsFirebase?.backend;
    if (backend?.mode === 'php'
        && /^uploads\/local\/\d{4}\/\d{2}\/[a-f0-9]{40}\.(?:jpg|png|pdf)$/.test(localPath)) {
        try {
            const localUrl = new URL(localPath, backend.projectUrl);
            return localUrl.origin === window.location.origin ? localUrl.href : '';
        } catch (_) {
            return '';
        }
    }
    return '';
};

window.addEventListener('ts-auth-ready', async () => {
    const complaintId = new URLSearchParams(window.location.search).get('id');
    if (!complaintId) {
        document.querySelector('.ts-page-title').textContent = 'Complaint not found';
        return;
    }

    const statusTone = status => ({
        OPEN: 'info',
        UNDER_INVESTIGATION: 'warning',
        AWAITING_INFORMATION: 'warning',
        RESOLVED: 'success',
        REJECTED: 'error'
    })[(status || '').toUpperCase()] || 'neutral';

    const loadComplaint = async () => {
        const complaint = await window.tsComplaints.getComplaint(complaintId);
        if (!complaint) throw new Error('Complaint not found.');

        document.querySelector('.ts-page-title').textContent = complaint.referenceNumber || complaint.id;
        document.querySelector('.ts-page-subtitle').textContent = `${complaint.category || 'Support request'} · ${complaint.complainantName || 'Unknown reporter'}`;
        document.getElementById('cmp-detail-container').style.display = 'grid';
        document.getElementById('action-buttons').style.display = 'flex';
        document.getElementById('val-desc').textContent = complaint.description || 'No description provided.';

        const status = (complaint.status || 'OPEN').toUpperCase();
        document.getElementById('val-status').innerHTML = `<span class="ts-chip ts-chip-${statusTone(status)}">${esc(status.replaceAll('_', ' '))}</span>`;

        const evidence = (Array.isArray(complaint.evidenceUrls) ? complaint.evidenceUrls : [])
            .map(safeEvidenceUrl)
            .filter(Boolean);
        document.getElementById('evidence-list').innerHTML = evidence.length
            ? evidence.map((url, index) => `<a class="ts-list-item" href="${esc(url)}" target="_blank" rel="noopener">Evidence ${index + 1}</a>`).join('')
            : '<div class="text-center secondary">No evidence provided</div>';

        const timeline = Array.isArray(complaint.timeline) && complaint.timeline.length
            ? complaint.timeline
            : [{ status: 'OPEN', note: 'Complaint submitted', timestamp: complaint.createdAt }];
        document.getElementById('val-timeline').innerHTML = timeline.map((item, index) => `
            <div class="ts-timeline-item ${index === timeline.length - 1 ? 'current' : ''}">
                <div class="ts-timeline-title">${esc(String(item.status || 'UPDATE').replaceAll('_', ' '))}</div>
                <div class="ts-timeline-meta">${esc(item.note || '')}${item.timestamp ? ` · ${esc(new Date(item.timestamp).toLocaleString())}` : ''}</div>
            </div>
        `).join('');

        document.getElementById('val-related').textContent = complaint.relatedBookingId || complaint.relatedTicketId || 'N/A';

        document.getElementById('btn-investigate').onclick = async () => {
            await window.tsComplaints.updateStatus(complaintId, 'UNDER_INVESTIGATION', 'Administrator review started.');
            await loadComplaint();
        };
        document.getElementById('btn-reject').onclick = async () => {
            const reason = prompt('Reason for rejection:');
            if (!reason) return;
            await window.tsComplaints.reject(complaintId, reason.trim());
            await loadComplaint();
        };
        document.getElementById('btn-resolve').onclick = async () => {
            const action = prompt('Resolution action:');
            if (!action) return;
            const explanation = prompt('Resolution explanation:');
            if (!explanation) return;
            await window.tsComplaints.resolve(complaintId, action.trim(), explanation.trim());
            await loadComplaint();
        };
    };

    try {
        await loadComplaint();
    } catch (error) {
        console.error(error);
        document.querySelector('.ts-page-title').textContent = error.message || 'Unable to load complaint';
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Complaint Investigation', 'complaints', $content, '..', '');
?>
