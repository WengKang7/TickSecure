<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Digital ticket wallet</div>
                <h1 class="ts-section-title">My Tickets</h1>
                <p class="ts-section-copy">View active, transferred, used and resale-listed NFT tickets owned by your
                    connected wallet.</p>
            </div><a class="ts-btn ts-btn-secondary"
                href="wallet.php"><?=ts_icon('wallet')?>
                Wallet 0x12A4…8F92</a>
        </div>
        <div class="ts-tabs mb-24" id="ticket-tabs">
            <button class="ts-tab active" data-filter="valid">Active</button>
            <button class="ts-tab" data-filter="listed">Listed for Resale</button>
            <button class="ts-tab" data-filter="transferred">Transferred</button>
            <button class="ts-tab" data-filter="used">Used</button>
            <button class="ts-tab" data-filter="cancelled">Cancelled / Expired</button>
        </div>
        <div class="ts-ticket-list" id="ticket-list">
             <p class="secondary" style="padding:40px; text-align:center">Loading...</p>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async (authEvent) => {
    if (!authEvent.detail) return;

    let allTickets = [];
    const container = document.getElementById('ticket-list');
    const tabs = document.querySelectorAll('#ticket-tabs .ts-tab');

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));

    const eventDateLabel = (event) => {
        const date = String(event?.date ?? event?.eventDate ?? '').trim();
        const time = String(event?.time ?? '').trim();
        return [date, time].filter(Boolean).join(' · ') || 'Date to be announced';
    };

    const withEventDates = async (items) => {
        const eventIds = [...new Set(items
            .filter(ticket => ticket.eventId && (!ticket.eventDate || !ticket.eventName))
            .map(ticket => ticket.eventId))];
        const eventPairs = await Promise.all(eventIds.map(async (eventId) => {
            try {
                return [eventId, await window.tsEvents.getEvent(eventId)];
            } catch (error) {
                console.warn('Unable to load ticket event details:', eventId, error);
                return [eventId, null];
            }
        }));
        const eventsById = new Map(eventPairs);

        return items.map(ticket => {
            const event = eventsById.get(ticket.eventId);
            return {
                ...ticket,
                eventName: ticket.eventName || event?.name || 'Untitled event',
                eventDate: ticket.eventDate || eventDateLabel(event)
            };
        });
    };
    
    const render = (filter) => {
        const statusesByFilter = {
            valid: ['VALID'],
            listed: ['LISTED_FOR_RESALE'],
            transferred: ['TRANSFERRED'],
            used: ['USED'],
            cancelled: ['CANCELLED', 'EXPIRED']
        };
        const filtered = allTickets.filter(t => statusesByFilter[filter]?.includes((t.status || '').toUpperCase()));
        
        if (filtered.length === 0) {
            container.innerHTML = '<p class="secondary" style="padding:40px; text-align:center; width:100%">No tickets found.</p>';
            return;
        }
        
        container.innerHTML = filtered.map(t => {
            const ticketStatus = (t.status || '').toUpperCase();
            const status = {
                VALID: { tone: 'success', label: 'Valid' },
                LISTED_FOR_RESALE: { tone: 'gold', label: 'Listed' },
                TRANSFERRED: { tone: 'neutral', label: 'Transferred' },
                USED: { tone: 'info', label: 'Used' },
                CANCELLED: { tone: 'error', label: 'Cancelled' },
                EXPIRED: { tone: 'error', label: 'Expired' }
            }[ticketStatus] || { tone: 'neutral', label: ticketStatus.replace(/_/g, ' ') || 'Unknown' };
            
            return `
            <a class="ts-ticket-card" href="ticket-detail.php?id=${encodeURIComponent(t.id)}">
                <div class="ts-ticket-thumb">${escapeHtml(t.eventName)}</div>
                <div class="ts-ticket-card-body">
                    <div class="flex justify-between">
                        <div class="ts-card-title">${escapeHtml(t.eventName)}</div>
                        <span class="ts-chip ts-chip-${status.tone}">${escapeHtml(status.label)}</span>
                    </div>
                    <div class="small secondary mt-8">${escapeHtml(t.eventDate)}</div>
                    <div class="small mt-16"><strong>${escapeHtml(t.categoryName || 'N/A')} &middot; Seat ${escapeHtml(t.seatId || 'N/A')}</strong></div>
                </div>
            </a>
            `;
        }).join('');
    };
    
    try {
        allTickets = await withEventDates(await window.tsTickets.getUserTickets());
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                render(tab.getAttribute('data-filter'));
            });
        });
        
        render('valid'); // default
    } catch (err) {
        console.error('Load error:', err);
    }
});
</script>

<?php
$content = ob_get_clean();
render_public_page('My Tickets', 'tickets', $content, '..', true);
?>
