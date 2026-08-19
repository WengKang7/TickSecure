<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Account history</div>
                <h1 class="ts-section-title">Booking History</h1>
                <p class="ts-section-copy">Search current and previous ticket bookings, payments and related NFT
                    tickets.</p>
            </div>
        </div>
        <div class="ts-card">
            <div class="ts-filter-bar">
                <div class="ts-input-wrap ts-search">
                    <?=ts_icon('search')?><input
                        class="ts-input" placeholder="Booking number or event name"></div><select class="ts-select">
                    <option>Upcoming</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                    <option>Refunded</option>
                </select>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Booking</th>
                            <th>Event</th>
                            <th>Category / Seat</th>
                            <th>Booking Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ([['TS20260001','Aurora After Dark','VIP1 · A06','17 Aug 2026','RM708.00','Confirmed'],['TS20250088','Velvet Hour Live','CAT1 · B08','02 Jul 2026','RM418.00','Confirmed'],['TS20250051','Silverline Orchestra','CAT2 · C11','11 May 2026','RM208.00','Completed']] as $b): ?>
                        <tr>
                            <td class="cell-title"><?=$b[0]?></td>
                            <td><?=$b[1]?></td>
                            <td><?=$b[2]?></td>
                            <td><?=$b[3]?></td>
                            <td><?=$b[4]?></td>
                            <td><?=ts_status($b[5], $b[5] === 'Completed' ? 'neutral' : 'success')?>
                            </td>
                            <td class="text-right"><a class="ts-btn ts-btn-secondary ts-btn-sm"
                                    href="booking-detail.php">View</a></td>
                        </tr><?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="ts-pagination"><span>3 bookings</span>
                <div class="ts-page-numbers"><span class="ts-page-num active">1</span></div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Booking History', 'tickets', $content, '..', true);
?>