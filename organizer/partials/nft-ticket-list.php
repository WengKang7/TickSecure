<?=ts_page_head('NFT Owner', 'Search and review your records.', '')?>
<div id="staff-list-page" data-kind="nft"></div>
<div class="ts-grid-2 mb-24"><p id="list-summary" role="status"></p></div>
<section class="ts-card"><div class="ts-filter-bar"><input id="list-search" class="ts-input" aria-label="Ticket, token, event or wallet" placeholder="Ticket, token, event or wallet"><select id="list-event" class="ts-select" aria-label="All events"><option value="">All events</option></select><select id="list-status" class="ts-select" aria-label="All minting status"><option value="">All minting status</option><option value="MINTED">MINTED</option><option value="PENDING">PENDING</option><option value="FAILED">FAILED</option></select></div>
<div class="ts-table-wrap"><table class="ts-table"><thead><tr><th>Ticket</th><th>Event / Category / Seat</th><th>Token</th><th>Owner wallet</th><th>Minting</th><th>Transaction</th><th>Details</th></tr></thead><tbody id="staff-list-body"><tr><td colspan="7">Loading...</td></tr></tbody></table></div></section>
<script src="<?=ts_asset_url('assets/js/ticket-display.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-page-tools.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/staff-lists.js', '..')?>"></script>
