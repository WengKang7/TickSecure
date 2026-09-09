<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<div id="action-buttons" style="display:none;"><button id="btn-suspend" class="ts-btn ts-btn-secondary">Suspend</button> <button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button> <button id="btn-approve" class="ts-btn ts-btn-success">Approve</button></div>')?>
<div id="event-detail-container" style="display:none;">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="ts-section-eyebrow">Buyer preview</div>
            <div class="ts-event-hero-detail" style="grid-template-columns:260px 1fr;gap:28px">
                <div class="ts-poster" style="min-height:320px">
                    <img id="val-poster" style="width:100%;height:100%;object-fit:cover;" src="" alt="" onerror="this.style.display='none'">
                    <div class="ts-poster-copy">
                        <div class="ts-poster-kicker" id="poster-org"></div>
                        <div class="ts-poster-title" id="poster-title"></div>
                    </div>
                </div>
                <div>
                    <h2 class="mt-0" id="val-title"></h2>
                    <p class="secondary" id="val-subtitle"></p>
                    <p class="secondary" id="val-desc"></p>
                    <div class="flex gap-8 wrap mt-16" id="val-badges"></div>
                </div>
            </div>
        </div>
        <div class="ts-card mt-20">
            <div class="ts-card-head">
                <div>
                    <div class="ts-card-title">Ticket Categories</div>
                    <div class="ts-card-sub">Mapped to Administrator-managed venue sections</div>
                </div>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Price</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody id="ticket-table-body">
                        <tr><td colspan="4" class="text-center secondary">No categories</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Submission Summary</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Organizer</div>
                <div class="ts-detail-value" id="val-org-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Venue Layout</div>
                <div class="ts-detail-value" id="val-venue-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Sales Period</div>
                <div class="ts-detail-value" id="val-sales"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Max / Buyer</div>
                <div class="ts-detail-value" id="val-max-tickets"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Resale</div>
                <div class="ts-detail-value" id="val-resale"></div>
            </div>
        </div>
        <div class="ts-alert ts-alert-warning mt-20">
            <?=ts_icon('alert')?>
            <div><strong>Review note</strong>
                <div class="small mt-8">Event approval controls whether the event becomes visible and purchasable by
                    Buyers.</div>
            </div>
        </div>
    </aside>
</div>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    
    if (!eventId) {
        document.querySelector('.ts-page-title').textContent = 'Event not found';
        return;
    }

    const loadEvent = async () => {
        try {
            const ev = await window.tsEvents.getEvent(eventId);
            if (!ev) throw new Error('Event not found');
            
            document.getElementById('event-detail-container').style.display = 'grid';
            document.querySelector('.ts-page-title').textContent = ev.name || 'Event Review';
            document.querySelector('.ts-page-subtitle').textContent = `Submitted by ${ev.organizerName || ev.organizerUid}`;
            
            if (ev.posterUrl) {
                const img = document.getElementById('val-poster');
                img.src = ev.posterUrl;
                img.style.display = 'block';
                document.querySelector('.ts-poster-copy').style.display = 'none';
            } else {
                document.getElementById('poster-org').textContent = ev.organizerName || 'Organizer';
                document.getElementById('poster-title').textContent = ev.name || 'Event';
            }

            document.getElementById('val-title').textContent = ev.name || 'Untitled Event';
            document.getElementById('val-subtitle').textContent = `${ev.date ? new Date(ev.date).toLocaleDateString() : 'No date'} · ${ev.venueName || ev.venueId}`;
            document.getElementById('val-desc').textContent = ev.description || 'No description provided.';
            
            const statusStr = (ev.status || 'DRAFT').toUpperCase();
            const toneMap = { 'PUBLISHED': 'success', 'APPROVED': 'info', 'REJECTED': 'error', 'DRAFT': 'neutral', 'PENDING_REVIEW': 'warning' };
            const tone = toneMap[statusStr] || 'neutral';
            
            let badges = `<span class="ts-chip ts-chip-${tone}">${statusStr}</span>`;
            if (ev.eventCategory) {
                badges += `<span class="ts-chip ts-chip-neutral">${ev.eventCategory}</span>`;
            }
            document.getElementById('val-badges').innerHTML = badges;
            
            if (ev.categories && ev.categories.length > 0) {
                document.getElementById('ticket-table-body').innerHTML = ev.categories.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.section}</td>
                        <td>RM${c.price}</td>
                        <td>${c.quantity}</td>
                    </tr>
                `).join('');
            }
            
            document.getElementById('val-org-name').textContent = ev.organizerName || ev.organizerUid;
            document.getElementById('val-venue-name').textContent = ev.venueName || ev.venueId;
            
            const salesPeriodStr = ev.salesStartDate ? `${new Date(ev.salesStartDate).toLocaleDateString()} - ${new Date(ev.salesEndDate).toLocaleDateString()}` : 'Not configured';
            document.getElementById('val-sales').textContent = salesPeriodStr;
            
            document.getElementById('val-max-tickets').textContent = ev.maxTicketsPerBuyer ? `${ev.maxTicketsPerBuyer} tickets` : 'Not configured';
            
            let resaleStr = 'Not configured';
            if (ev.resaleEnabled !== undefined) {
                resaleStr = ev.resaleEnabled ? `Enabled · Max ${ev.maxResaleMarkup}% markup` : 'Disabled';
            }
            document.getElementById('val-resale').textContent = resaleStr;
            
            const btnGroup = document.getElementById('action-buttons');
            const btnApprove = document.getElementById('btn-approve');
            const btnReject = document.getElementById('btn-reject');
            const btnSuspend = document.getElementById('btn-suspend');

            btnGroup.style.display = 'flex';
            if (statusStr === 'PENDING_REVIEW') {
                btnApprove.style.display = 'block';
                btnReject.style.display = 'block';
                btnSuspend.style.display = 'none';
            } else if (statusStr === 'PUBLISHED' || statusStr === 'APPROVED') {
                btnApprove.style.display = 'none';
                btnReject.style.display = 'none';
                btnSuspend.style.display = 'block';
            } else {
                btnGroup.style.display = 'none';
            }
            
            btnApprove.onclick = async () => {
                if (confirm('Approve this event?')) {
                    await window.tsEvents.approveEvent(eventId);
                    await loadEvent();
                }
            };
            
            btnReject.onclick = async () => {
                const reason = prompt('Reason for rejection:');
                if (reason) {
                    await window.tsEvents.rejectEvent(eventId, reason);
                    await loadEvent();
                }
            };

            btnSuspend.onclick = async () => {
                const reason = prompt('Reason for suspension:');
                if (reason) {
                    await window.tsEvents.suspendEvent(eventId, reason);
                    await loadEvent();
                }
            };

        } catch (err) {
            console.error(err);
            document.querySelector('.ts-page-title').textContent = 'Error loading event';
        }
    };
    
    await loadEvent();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Review Event', 'events', $content, '..', '');
?>