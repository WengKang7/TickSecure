<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight"><div class="ts-container">
  <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">Discover</div><h1 class="ts-section-title">Events</h1><p class="ts-section-copy">Browse approved and published events available on TickSecure.</p></div></div>
  <div class="ts-card mb-24"><div class="ts-filter-bar"><div class="ts-input-wrap ts-search"><?=ts_icon('search')?><input class="ts-input" placeholder="Search event, venue or organizer"></div><select class="ts-select"><option>Date</option><option>This month</option><option>Next month</option></select><select class="ts-select"><option>Venue</option><option>Axiata Arena</option><option>Merdeka Hall</option></select><select class="ts-select"><option>Price</option><option>Below RM300</option><option>RM300–RM600</option></select><button class="ts-btn ts-btn-secondary ts-btn-sm"><?=ts_icon('filter')?> Filters</button></div></div>
  <div class="ts-event-grid">
    <?php $events=[['Aurora After Dark','18 Oct 2026 · 8:00 PM','Merdeka Hall · Kuala Lumpur','RM288','Available',''],['Velvet Hour Live','02 Nov 2026 · 7:30 PM','Axiata Arena · Bukit Jalil','RM198','Limited','light'],['Midnight Resonance','21 Nov 2026 · 8:30 PM','Zepp KL · Kuala Lumpur','RM238','Available','stone'],['The Ivory Sessions','06 Dec 2026 · 8:00 PM','Plenary Hall · KLCC','RM328','Available','light'],['Nocturne City','12 Dec 2026 · 9:00 PM','Merdeka Hall · Kuala Lumpur','RM268','Limited','wine'],['Silverline Orchestra','19 Dec 2026 · 7:00 PM','Axiata Arena · Bukit Jalil','RM188','Available','stone']]; foreach($events as $e): ?>
      <a class="ts-event-card" href="event-detail.php"><div class="ts-event-art <?=$e[5]?>"><strong><?=$e[0]?></strong></div><div class="ts-event-body"><div class="ts-event-date"><?=$e[1]?></div><div class="ts-event-name"><?=$e[0]?></div><div class="ts-event-meta"><?=$e[2]?></div><div class="ts-event-foot"><span class="ts-price">From <?=$e[3]?></span><?=ts_status($e[4],$e[4]==='Limited'?'warning':'success')?></div></div></a>
    <?php endforeach; ?>
  </div>
  <div class="ts-pagination mt-24"><span>Showing 1–6 of 24 events</span><div class="ts-page-numbers"><span class="ts-page-num active">1</span><span class="ts-page-num">2</span><span class="ts-page-num">3</span><span class="ts-page-num">4</span></div></div>
</div></main>

<?php
$content=ob_get_clean();
render_public_page('Events','events',$content,'..',true);
?>
