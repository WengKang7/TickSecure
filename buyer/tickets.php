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
window.addEventListener('ts-auth-ready', async () => {
    let allTickets = [];
    const container = document.getElementById('ticket-list');
    const tabs = document.querySelectorAll('#ticket-tabs .ts-tab');
    
    const render = (filter) => {
        const filtered = allTickets.filter(t => t.status === filter || (filter === 'cancelled' && t.status === 'expired'));
        
        if (filtered.length === 0) {
            container.innerHTML = '<p class="secondary" style="padding:40px; text-align:center; width:100%">No tickets found.</p>';
            return;
        }
        
        container.innerHTML = filtered.map(t => {
            let tone = 'success';
            let label = 'Valid';
            if (t.status === 'listed') { tone = 'gold'; label = 'Listed'; }
            else if (t.status === 'transferred') { tone = 'neutral'; label = 'Transferred'; }
            else if (t.status === 'used') { tone = 'info'; label = 'Used'; }
            else if (t.status === 'cancelled' || t.status === 'expired') { tone = 'error'; label = 'Cancelled'; }
            
            return \`
            <a class="ts-ticket-card" href="ticket-detail.php?id=\${t.id}">
                <div class="ts-ticket-thumb">\${t.eventName}</div>
                <div class="ts-ticket-card-body">
                    <div class="flex justify-between">
                        <div class="ts-card-title">\${t.eventName}</div>
                        <span class="ts-chip ts-chip-\${tone}">\${label}</span>
                    </div>
                    <div class="small secondary mt-8">\${t.eventDate || 'Upcoming'}</div>
                    <div class="small mt-16"><strong>\${t.category} · Seat \${t.seat}</strong></div>
                </div>
            </a>
            \`;
        }).join('');
    };
    
    try {
        allTickets = await window.tsTickets.getUserTickets();
        
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