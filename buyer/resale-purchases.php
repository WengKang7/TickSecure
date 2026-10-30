<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight"><div class="ts-container">
    <?=ts_page_head('Resale Purchases', 'Your completed secondary-market purchases.', '<a class="ts-btn ts-btn-secondary" href="../public/resale.php">Browse resale</a>')?>
    <div class="ts-card ts-card-pad" id="resale-purchases" role="status">Loading purchases…</div>
</div></main>
<script type="module">
let initialized = false;
async function initialize() {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    const container = document.getElementById('resale-purchases');
    try {
        const purchases = await window.tsResale.getPurchases();
        container.replaceChildren();
        if (!purchases.length) container.textContent = 'No resale purchases yet.';
        purchases.forEach(listing => {
            const row = document.createElement('div'); row.className = 'ts-list-item';
            const copy = document.createElement('div');
            const title = document.createElement('strong'); title.textContent = listing.eventName || 'Resale ticket';
            const details = document.createElement('p'); details.className = 'small secondary';
            details.textContent = `${listing.categoryName || 'Ticket'} · Seat ${listing.seatId || '-'} · Total RM${(Number(listing.resalePrice) + 20).toFixed(2)} · ${listing.completedAt || ''}`;
            const link = document.createElement('a'); link.className = 'ts-btn ts-btn-secondary ts-btn-sm';
            link.textContent = 'View receipt'; link.href = `../public/resale-detail.php?id=${encodeURIComponent(listing.id)}`;
            copy.append(title, details); row.append(copy, link); container.append(row);
        });
    } catch (error) { container.textContent = error.message || 'Unable to load purchases.'; }
}
window.addEventListener('ts-auth-ready', initialize);
if (window.tsCurrentUser?.uid) initialize();
</script>
<?php
$content = ob_get_clean();
render_public_page('Resale Purchases', 'resale', $content, '..', true);
?>
