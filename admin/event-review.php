<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading…', '', '<div id="action-buttons" style="display:none"><button id="btn-suspend" class="ts-btn ts-btn-secondary" type="button">Suspend</button><button id="btn-reject" class="ts-btn ts-btn-danger" type="button">Reject</button><button id="btn-approve" class="ts-btn ts-btn-success" type="button">Approve &amp; Publish</button></div>')?>
<p id="review-action-message" class="small mb-16" aria-live="polite"></p>
<div id="event-detail-container" style="display:none">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="ts-section-eyebrow">Buyer preview</div>
            <div class="ts-event-hero-detail" style="grid-template-columns:260px 1fr;gap:28px">
                <div class="ts-poster" style="min-height:320px">
                    <img id="val-poster" style="width:100%;height:100%;object-fit:cover;display:none" src="" alt="" onerror="this.style.display='none'">
                    <div class="ts-poster-copy" id="poster-copy">
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
                    <div class="ts-card-sub">Mapped to administrator-managed venue sections</div>
                </div>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section ID</th>
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
                <div class="small mt-8">Approval publishes the event and makes it available to buyers once its configured sales window opens.</div>
            </div>
        </div>
    </aside>
</div>

<script type="module">
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

const amount = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = value => {
    if (!value) return 'Not configured';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const eventCategories = categories => {
    if (Array.isArray(categories)) {
        return categories.map((category, index) => ({
            sectionId: category.sectionId || category.section || String(index + 1),
            ...category
        }));
    }
    return Object.entries(categories || {}).map(([sectionId, category]) => ({ sectionId, ...category }));
};

window.addEventListener('ts-auth-ready', async authEvent => {
    const profile = authEvent.detail;
    if (profile?.role !== 'admin') return;

    const eventId = new URLSearchParams(window.location.search).get('id');
    const actionMessage = document.getElementById('review-action-message');
    const actionButtons = document.getElementById('action-buttons');
    const approveButton = document.getElementById('btn-approve');
    const rejectButton = document.getElementById('btn-reject');
    const suspendButton = document.getElementById('btn-suspend');

    const setActionMessage = (message = '', tone = '') => {
        actionMessage.textContent = message;
        actionMessage.style.color = tone === 'error'
            ? 'var(--ts-danger)'
            : (tone === 'success' ? 'var(--ts-success)' : '');
    };

    if (!eventId) {
        document.querySelector('.ts-page-title').textContent = 'Event not found';
        setActionMessage('An event ID is required to review a submission.', 'error');
        return;
    }

    const renderCategories = categories => {
        const rows = eventCategories(categories);
        const tableBody = document.getElementById('ticket-table-body');
        if (!rows.length) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center secondary">No categories configured</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map(category => `
            <tr>
                <td>${escapeHtml(category.name || category.categoryName || category.sectionId)}</td>
                <td>${escapeHtml(category.sectionId)}</td>
                <td>RM${amount(category.price).toFixed(2)}</td>
                <td>${Math.max(0, Math.floor(amount(category.quantity)))}</td>
            </tr>`).join('');
    };

    const configureActions = event => {
        const status = String(event.status || 'DRAFT').toUpperCase();
        actionButtons.style.display = 'none';
        approveButton.style.display = 'none';
        rejectButton.style.display = 'none';
        suspendButton.style.display = 'none';

        if (status === 'PENDING_REVIEW') {
            actionButtons.style.display = 'flex';
            approveButton.style.display = 'block';
            rejectButton.style.display = 'block';
        } else if (status === 'PUBLISHED') {
            actionButtons.style.display = 'flex';
            suspendButton.style.display = 'block';
        }
    };

    const loadEvent = async () => {
        try {
            if (!window.tsEvents) throw new Error('Event services are still loading.');
            const event = await window.tsEvents.getEvent(eventId);
            if (!event) throw new Error('Event not found.');

            document.getElementById('event-detail-container').style.display = 'grid';
            document.querySelector('.ts-page-title').textContent = event.name || 'Event Review';
            document.querySelector('.ts-page-subtitle').textContent = `Submitted by ${event.organizerName || event.organizerUid || 'Unknown organizer'}`;

            const poster = document.getElementById('val-poster');
            const posterCopy = document.getElementById('poster-copy');
            if (event.posterUrl) {
                poster.src = event.posterUrl;
                poster.alt = `${event.name || 'Event'} poster`;
                poster.style.display = 'block';
                posterCopy.style.display = 'none';
            } else {
                poster.style.display = 'none';
                posterCopy.style.display = 'block';
                document.getElementById('poster-org').textContent = event.organizerName || 'Organizer';
                document.getElementById('poster-title').textContent = event.name || 'Event';
            }

            document.getElementById('val-title').textContent = event.name || 'Untitled event';
            document.getElementById('val-subtitle').textContent = [formatDate(event.date), event.time, event.venueName || event.venueId].filter(Boolean).join(' · ');
            document.getElementById('val-desc').textContent = event.description || 'No description provided.';

            const status = String(event.status || 'DRAFT').toUpperCase();
            const statusTone = {
                PUBLISHED: 'success',
                PENDING_REVIEW: 'warning',
                REJECTED: 'error',
                SUSPENDED: 'error',
                CANCELLED: 'neutral',
                DRAFT: 'neutral'
            }[status] || 'neutral';
            const categoryBadge = event.eventCategory
                ? `<span class="ts-chip ts-chip-neutral">${escapeHtml(event.eventCategory)}</span>`
                : '';
            document.getElementById('val-badges').innerHTML = `<span class="ts-chip ts-chip-${statusTone}">${escapeHtml(status)}</span>${categoryBadge}`;

            renderCategories(event.categories);
            document.getElementById('val-org-name').textContent = event.organizerName || event.organizerUid || 'Not available';
            document.getElementById('val-venue-name').textContent = event.venueName || event.venueId || 'Not configured';
            document.getElementById('val-sales').textContent = event.salesStartDate || event.salesEndDate
                ? `${formatDate(event.salesStartDate)} – ${formatDate(event.salesEndDate)}`
                : 'Not configured';
            document.getElementById('val-max-tickets').textContent = event.maxTicketsPerBuyer
                ? `${event.maxTicketsPerBuyer} ticket${Number(event.maxTicketsPerBuyer) === 1 ? '' : 's'}`
                : 'Not configured';

            const resaleDetails = [];
            if (event.resaleEnabled === true) {
                resaleDetails.push('Enabled');
                if (Number.isFinite(Number(event.maxResaleMarkup))) resaleDetails.push(`max ${amount(event.maxResaleMarkup)}% markup`);
                if (amount(event.maxResalePrice) > 0) resaleDetails.push(`cap RM${amount(event.maxResalePrice).toFixed(2)}`);
            }
            document.getElementById('val-resale').textContent = resaleDetails.length ? resaleDetails.join(' · ') : 'Disabled';
            configureActions(event);
            setActionMessage('');
        } catch (error) {
            console.error('Unable to load event review:', error);
            document.querySelector('.ts-page-title').textContent = 'Unable to load event';
            setActionMessage(error?.message || 'The event could not be loaded.', 'error');
        }
    };

    const runAction = async (button, action, successMessage) => {
        button.disabled = true;
        const previousLabel = button.textContent;
        button.textContent = 'Saving…';
        setActionMessage('Saving event review decision…');
        try {
            await action();
            await loadEvent();
            setActionMessage(successMessage, 'success');
        } catch (error) {
            console.error('Unable to save event review decision:', error);
            setActionMessage(error?.message || 'The review decision could not be saved.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = previousLabel;
        }
    };

    approveButton.addEventListener('click', () => {
        if (!window.confirm('Approve and publish this event?')) return;
        runAction(approveButton, () => window.tsEvents.approveEvent(eventId), 'Event approved and published.');
    });

    rejectButton.addEventListener('click', () => {
        const reason = window.prompt('Reason for rejection:');
        if (reason === null) return;
        if (!reason.trim()) {
            setActionMessage('A rejection reason is required.', 'error');
            return;
        }
        runAction(rejectButton, () => window.tsEvents.rejectEvent(eventId, reason.trim()), 'Event rejected.');
    });

    suspendButton.addEventListener('click', () => {
        const reason = window.prompt('Reason for suspension:');
        if (reason === null) return;
        if (!reason.trim()) {
            setActionMessage('A suspension reason is required.', 'error');
            return;
        }
        runAction(suspendButton, () => window.tsEvents.suspendEvent(eventId, reason.trim()), 'Event suspended.');
    });

    await loadEvent();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Review Event', 'events', $content, '..', '');
?>
