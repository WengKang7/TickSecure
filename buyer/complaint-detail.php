<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow" id="val-id">Loading...</div>
                <h1 class="ts-section-title" id="val-category">Loading...</h1>
                <p class="ts-section-copy" id="val-dates">...</p>
            </div>
            <div id="val-status-head"></div>
        </div>
        <div class="ts-content-grid">
            <div class="ts-card ts-card-pad">
                <div class="ts-card-title">Complaint details</div>
                <p class="secondary" id="val-desc">Loading details...</p>
                <div class="ts-divider"></div>
                <div class="ts-card-title">Progress</div>
                <div class="ts-timeline mt-20" id="timeline-container">
                    <p class="secondary">Loading progress...</p>
                </div>
            </div>
            <aside>
                <div class="ts-card ts-card-pad">
                    <div class="ts-card-title">Related information</div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Booking</div>
                        <div class="ts-detail-value" id="val-booking">None</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Evidence</div>
                        <div class="ts-detail-value" id="val-evidence">None provided</div>
                    </div>
                </div>
            </aside>
        </div>
    </div>
</main>

<script type="module">
const escapeHtml = value => String(value ?? '')
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
        // A local PHP fallback stores a deliberately relative, allow-listed
        // upload path rather than an arbitrary public URL.
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
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) return;

    try {
        const c = await window.tsComplaints.getComplaint(id);
        
        document.getElementById('val-id').textContent = c.id;
        document.getElementById('val-category').textContent = c.category;
        
        const submitStr = c.createdAt ? (typeof c.createdAt.toDate === 'function' ? c.createdAt.toDate().toLocaleDateString() : c.createdAt) : '-';
        const updateStr = c.updatedAt ? (typeof c.updatedAt.toDate === 'function' ? c.updatedAt.toDate().toLocaleDateString() : c.updatedAt) : submitStr;
        document.getElementById('val-dates').textContent = `Submitted ${submitStr} · Last updated ${updateStr}`;
        
        const complaintStatus = (c.status || 'OPEN').toUpperCase();
        let tone = 'warning';
        let status = complaintStatus.replace(/_/g, ' ');
        if (complaintStatus === 'OPEN') { tone = 'info'; status = 'Open'; }
        else if (complaintStatus === 'RESOLVED') { tone = 'success'; status = 'Resolved'; }
        else if (complaintStatus === 'REJECTED') { tone = 'error'; status = 'Rejected'; }
        else if (complaintStatus === 'UNDER_INVESTIGATION' || complaintStatus === 'INVESTIGATING') { tone = 'warning'; status = 'Under Investigation'; }
        
        document.getElementById('val-status-head').innerHTML = `<span class="ts-chip ts-chip-${tone}">${escapeHtml(status)}</span>`;
        
        document.getElementById('val-desc').textContent = c.description || 'No description provided.';
        document.getElementById('val-booking').textContent = c.relatedBookingId || 'None';
        const evidenceUrls = Array.isArray(c.evidenceUrls) ? c.evidenceUrls : [];
        const safeEvidenceUrls = evidenceUrls.map(safeEvidenceUrl).filter(Boolean);
        if (safeEvidenceUrls.length > 0) {
            document.getElementById('val-evidence').innerHTML = safeEvidenceUrls
                .map(url => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">View File</a>`)
                .join('<br>');
        }
        
        const timeline = c.timeline || [];
        const tlContainer = document.getElementById('timeline-container');
        
        if (timeline.length > 0) {
            tlContainer.innerHTML = timeline.map((h, i) => `
                <div class="ts-timeline-item ${i === timeline.length - 1 ? 'current' : ''}">
                    <div class="ts-timeline-title">${escapeHtml(h.status || h.title || 'Update')}</div>
                    <div class="ts-timeline-meta">${escapeHtml(h.timestamp || '')} · ${escapeHtml(h.note || '')}</div>
                </div>
            `).join('');
        } else {
            tlContainer.innerHTML = `
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Submitted</div>
                    <div class="ts-timeline-meta">Complaint received</div>
                </div>
            `;
        }
        
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Complaint Details', 'tickets', $content, '..', true);
?>
