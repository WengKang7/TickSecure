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
        document.getElementById('val-dates').textContent = \`Submitted \${submitStr} · Last updated \${updateStr}\`;
        
        let tone = 'warning';
        let status = 'Under Investigation';
        if (c.status === 'open') { tone = 'info'; status = 'Open'; }
        else if (c.status === 'resolved') { tone = 'success'; status = 'Resolved'; }
        else if (c.status === 'rejected') { tone = 'error'; status = 'Rejected'; }
        else if (c.status === 'investigating') { tone = 'warning'; status = 'Investigating'; }
        
        document.getElementById('val-status-head').innerHTML = \`<span class="ts-chip ts-chip-\${tone}">\${status}</span>\`;
        
        document.getElementById('val-desc').textContent = c.description || 'No description provided.';
        document.getElementById('val-booking').textContent = c.relatedBookingId || 'None';
        if (c.evidenceUrl) {
            document.getElementById('val-evidence').innerHTML = \`<a href="\${c.evidenceUrl}" target="_blank">View File</a>\`;
        }
        
        const timeline = c.history || [];
        const tlContainer = document.getElementById('timeline-container');
        
        if (timeline.length > 0) {
            tlContainer.innerHTML = timeline.map((h, i) => \`
                <div class="ts-timeline-item \${i === timeline.length - 1 ? 'current' : ''}">
                    <div class="ts-timeline-title">\${h.status || h.title}</div>
                    <div class="ts-timeline-meta">\${h.date || ''} · \${h.note || ''}</div>
                </div>
            \`).join('');
        } else {
            tlContainer.innerHTML = \`
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Submitted</div>
                    <div class="ts-timeline-meta">Complaint received</div>
                </div>
            \`;
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