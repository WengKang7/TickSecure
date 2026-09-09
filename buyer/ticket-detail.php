<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-content-grid">
            <div class="ts-ticket-pass">
                <div class="ts-ticket-head">
                    <div><small>TickSecure Verified Ticket</small>
                        <div class="ts-ticket-event" id="val-event">Loading...</div>
                        <div class="small mt-8" style="color:#D0D5DD" id="val-event-meta">...</div>
                    </div>
                    <div id="val-status"></div>
                </div>
                <div class="ts-ticket-body">
                    <div class="ts-ticket-grid">
                        <div>
                            <div class="ts-ticket-label">Category</div>
                            <div class="ts-ticket-value" id="val-category">...</div>
                        </div>
                        <div>
                            <div class="ts-ticket-label">Section</div>
                            <div class="ts-ticket-value" id="val-section">...</div>
                        </div>
                        <div>
                            <div class="ts-ticket-label">Seat</div>
                            <div class="ts-ticket-value" id="val-seat">...</div>
                        </div>
                    </div>
                    <div class="ts-qr" id="qr-container"></div>
                    <div class="text-center small secondary">Present this QR code at event entry. It is validated
                        against current ownership and usage status.</div>
                </div>
            </div>
            <aside>
                <div class="ts-card ts-card-pad">
                    <div class="ts-card-title">Ticket ownership</div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Current owner</div>
                        <div class="ts-detail-value ts-wallet-id" id="val-owner">...</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Token ID</div>
                        <div class="ts-detail-value" id="val-token-id">...</div>
                    </div>
                    <div class="ts-detail-item">
                        <div class="ts-detail-label">Ticket status</div>
                        <div class="ts-detail-value" id="val-status-label">
                            ...
                        </div>
                    </div>
                    <div class="ts-grid-2 mt-20"><a class="ts-btn ts-btn-secondary"
                            href="#" id="btn-transfer">Transfer</a><a class="ts-btn ts-btn-primary"
                            href="#" id="btn-resale">List for Resale</a></div>
                    <div class="ts-divider"></div><a class="ts-btn ts-btn-tertiary w-full" href="#history">View
                        Ownership History</a>
                    <div class="ts-accordion mt-12"><button class="ts-accordion-trigger">Blockchain details <span
                                class="chev"><?=ts_icon('chevron-down')?></span></button>
                        <div class="ts-accordion-panel">
                            <div class="small secondary">Contract</div>
                            <div class="ts-copy-code mt-8" id="val-contract">Loading...</div>
                            <div class="small secondary mt-12">Mint transaction</div>
                            <div class="ts-copy-code mt-8" id="val-tx">Loading...</div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
        <div class="ts-card ts-card-pad mt-24" id="history">
            <div class="ts-card-title">Ownership history</div>
            <div class="ts-timeline mt-20" id="timeline-container">
                <p class="secondary">Loading history...</p>
            </div>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');
    if (!ticketId) return;

    try {
        const ticket = await window.tsTickets.getTicket(ticketId);
        
        document.getElementById('val-event').textContent = ticket.eventName;
        document.getElementById('val-event-meta').textContent = ticket.eventDate || 'Upcoming Event';
        
        let tone = 'success';
        let label = 'Valid';
        if (ticket.status === 'listed') { tone = 'gold'; label = 'Listed'; }
        else if (ticket.status === 'transferred') { tone = 'neutral'; label = 'Transferred'; }
        else if (ticket.status === 'used') { tone = 'info'; label = 'Used'; }
        else if (ticket.status === 'cancelled') { tone = 'error'; label = 'Cancelled'; }
        
        const statusHtml = \`<span class="ts-chip ts-chip-\${tone}">\${label}</span>\`;
        document.getElementById('val-status').innerHTML = statusHtml;
        document.getElementById('val-status-label').innerHTML = statusHtml;
        
        document.getElementById('val-category').textContent = ticket.category || 'N/A';
        document.getElementById('val-section').textContent = ticket.sectionId || 'N/A';
        document.getElementById('val-seat').textContent = ticket.seat || 'N/A';
        
        document.getElementById('val-owner').textContent = ticket.ownerWallet || 'Unassigned';
        document.getElementById('val-token-id').textContent = ticket.tokenId || 'Pending Mint';
        
        document.getElementById('btn-transfer').href = \`ticket-transfer.php?ticketId=\${ticket.id}\`;
        document.getElementById('btn-resale').href = \`resale-new.php?ticketId=\${ticket.id}\`;
        
        if (ticket.contractAddress) document.getElementById('val-contract').textContent = ticket.contractAddress;
        if (ticket.mintTxHash) document.getElementById('val-tx').textContent = ticket.mintTxHash;
        
        const history = ticket.history || [];
        const tlContainer = document.getElementById('timeline-container');
        if (history.length > 0) {
            tlContainer.innerHTML = history.map((h, i) => \`
                <div class="ts-timeline-item \${i === 0 ? 'current' : ''}">
                    <div class="ts-timeline-title">\${h.title}</div>
                    <div class="ts-timeline-meta">\${h.date || 'Just now'}</div>
                </div>
            \`).join('');
        } else {
            tlContainer.innerHTML = \`
                <div class="ts-timeline-item current">
                    <div class="ts-timeline-title">Issued</div>
                    <div class="ts-timeline-meta">Ticket created</div>
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
render_public_page('Digital Ticket', 'tickets', $content, '..', true);
?>