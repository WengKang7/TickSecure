<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-collections-page">
  <div class="ts-container">
    <header class="ts-collection-heading">
      <div><div class="ts-section-eyebrow">The moments you own</div><h1>Your NFT collection.</h1><p>A colourful collectible for every ticket you own.</p></div>
      <div class="ts-collection-heading-actions"><a class="ts-btn ts-btn-secondary" href="tickets.php">My tickets <?=ts_icon('ticket')?></a><a class="ts-btn ts-btn-primary" href="blockchain.php">NFT transactions <?=ts_icon('arrow-right')?></a></div>
    </header>
    <div class="ts-collection-stats" aria-label="Collection summary">
      <div><span>Collectibles</span><strong id="collection-total">&mdash;</strong></div>
      <div><span>Minted NFTs</span><strong id="collection-minted">&mdash;</strong></div>
      <div><span>Events</span><strong id="collection-events">&mdash;</strong></div>
    </div>
    <div class="ts-collection-toolbar">
      <div class="ts-collection-search"><label class="ts-sr-only" for="collection-search">Search your collection</label><?=ts_icon('search')?><input type="search" id="collection-search" placeholder="Search event, category, seat or ticket" maxlength="160"></div>
      <div class="ts-collection-filters" role="group" aria-label="NFT status"><button type="button" data-collection-filter="all" aria-pressed="true">All tickets</button><button type="button" data-collection-filter="minted" aria-pressed="false">NFT minted</button><button type="button" data-collection-filter="pending" aria-pressed="false">Not confirmed</button></div>
      <button type="button" class="ts-btn ts-btn-secondary" id="collection-refresh">Refresh</button>
    </div>
    <p class="small secondary ts-collection-status" id="collection-status" role="status" aria-live="polite">Loading your collection...</p>
    <div class="ts-alert ts-alert-error mb-20" id="collection-error" role="alert" hidden></div>
    <section class="ts-collectibles-grid" id="collection-grid" aria-label="Your ticket collectibles" aria-busy="true"></section>
    <div class="ts-collection-empty" id="collection-empty" hidden><h2 id="collection-empty-title">Your collection starts here.</h2><p class="secondary" id="collection-empty-copy">Tickets you own will appear here with their own collectible artwork.</p><a class="ts-btn ts-btn-primary" id="collection-browse" href="../public/events.php">Explore events <?=ts_icon('arrow-right')?></a></div>
  </div>
</main>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/collectible-art.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/buyer-collections.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_public_page('NFT collection', 'tickets', $content, '..', true);
?>
