<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container">
  <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Official secondary market</div><h1 class="ts-section-title">Verified resale tickets</h1><p class="ts-section-copy">Buy tickets from verified current owners within organizer-defined resale rules.</p></div></div>
  <div class="ts-card mb-24"><div class="ts-filter-bar"><div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input class="ts-input" placeholder="Search event or ticket category"></div><select class="ts-select"><option>Event</option><option>Aurora After Dark</option></select><select class="ts-select"><option>Category</option><option>VIP1</option><option>CAT1</option></select><select class="ts-select"><option>Price</option><option>Lowest first</option></select></div></div>
  <div class="ts-grid-3">
    <?php foreach([['Aurora After Dark','VIP1','A12','RM688','RM720','RM756'],['Velvet Hour Live','CAT1','B08','RM398','RM420','RM438'],['Midnight Resonance','VIP2','C04','RM518','RM540','RM570'],['Aurora After Dark','CAT1','B21','RM488','RM500','RM536'],['The Ivory Sessions','CAT2','C15','RM328','RM340','RM360'],['Nocturne City','VIP1','A03','RM568','RM590','RM624']] as $r): ?>
    <a class="ts-card ts-card-pad" href="resale-detail.php"><div class="flex justify-between items-center"><div class="ts-card-title"><?=$r[0]?></div><?=ts_status('Rule compliant','success')?></div><div class="ts-divider"></div><div class="ts-detail-grid"><div class="ts-detail-item"><div class="ts-detail-label">Category</div><div class="ts-detail-value"><?=$r[1]?></div></div><div class="ts-detail-item"><div class="ts-detail-label">Seat</div><div class="ts-detail-value"><?=$r[2]?></div></div><div class="ts-detail-item"><div class="ts-detail-label">Original</div><div class="ts-detail-value"><?=$r[3]?></div></div><div class="ts-detail-item"><div class="ts-detail-label">Resale</div><div class="ts-detail-value"><?=$r[4]?></div></div></div><div class="small secondary mt-16">Maximum allowed <?=$r[5]?> · Seller 0x81A3…30F2</div></a>
    <?php endforeach; ?>
  </div>
</div></main>

<?php
$content=ob_get_clean();
render_public_page('Resale Marketplace','resale',$content,'..',true);
?>
