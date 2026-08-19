<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Notifications', 'Event approval, ticket issuance, secondary-market and system updates for your organization.', '<button class="ts-btn ts-btn-secondary" data-toast="Notifications marked read">Mark all as read</button>')?>
<div class="ts-card ts-card-pad">
    <div class="ts-list">
        <div class="ts-list-item">
            <div class="flex gap-12"><span
                    class="ts-kpi-icon"><?=ts_icon('calendar')?></span>
                <div>
                    <div class="ts-list-title">Aurora After Dark approved</div>
                    <div class="ts-list-sub">Administrator approved your event submission.</div>
                </div>
            </div>
            <?=ts_status('New', 'info')?>
        </div>
        <div class="ts-list-item">
            <div class="flex gap-12"><span
                    class="ts-kpi-icon"><?=ts_icon('alert')?></span>
                <div>
                    <div class="ts-list-title">Resale rule violation detected</div>
                    <div class="ts-list-sub">Ticket TS-TK-0884 exceeds the organizer-defined maximum.</div>
                </div>
            </div>
            <?=ts_status('Action', 'warning')?>
        </div>
        <div class="ts-list-item">
            <div class="flex gap-12"><span
                    class="ts-kpi-icon"><?=ts_icon('activity')?></span>
                <div>
                    <div class="ts-list-title">NFT mint failed</div>
                    <div class="ts-list-sub">Three tickets require review.</div>
                </div>
            </div>
            <?=ts_status('Failed', 'error')?>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Notifications', 'notifications', $content, '..', '');
?>