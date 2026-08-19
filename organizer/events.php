<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('My Events', 'Create, submit and manage your organization’s concert events.', '<a class="ts-btn ts-btn-primary" href="event-new.php">'.ts_icon('plus').' Create Event</a>')?>
<div class="ts-card">
    <div class="ts-filter-bar">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input
                class="ts-input" placeholder="Search event"></div><select class="ts-select">
            <option>All statuses</option>
            <option>Draft</option>
            <option>Pending Approval</option>
            <option>Published</option>
            <option>Rejected</option>
        </select><select class="ts-select">
            <option>All venues</option>
            <option>Merdeka Hall</option>
            <option>Axiata Arena</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Venue</th>
                    <th>Event Date</th>
                    <th>Sales Period</th>
                    <th>Status</th>
                    <th>Tickets Sold</th>
                    <th>Updated</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ([['Aurora After Dark','Merdeka Hall','18 Oct 2026','01 Sep – 18 Oct','Published','1,244','Today'],['Velvet Hour Live','Axiata Arena','02 Nov 2026','15 Sep – 02 Nov','Approved','988','Yesterday'],['Nocturne City','Merdeka Hall','12 Dec 2026','Not configured','Rejected','—','16 Aug'],['The Ivory Sessions','Plenary Hall','06 Dec 2026','Not configured','Draft','—','14 Aug']] as $e): ?>
                <tr>
                    <td class="cell-title"><?=$e[0]?></td>
                    <td><?=$e[1]?></td>
                    <td><?=$e[2]?></td>
                    <td><?=$e[3]?></td>
                    <td><?=ts_status($e[4], ['Published' => 'success','Approved' => 'info','Rejected' => 'error','Draft' => 'neutral'][$e[4]])?>
                    </td>
                    <td><?=$e[5]?></td>
                    <td><?=$e[6]?></td>
                    <td><a class="ts-btn ts-btn-secondary ts-btn-sm" href="event-detail.php">Open</a></td>
                </tr><?php endforeach;?>
            </tbody>
        </table>
    </div>
    <div class="ts-pagination"><span>4 events</span>
        <div class="ts-page-numbers"><span class="ts-page-num active">1</span></div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'My Events', 'events', $content, '..', '');
?>