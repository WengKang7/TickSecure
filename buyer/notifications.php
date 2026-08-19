<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Updates</div>
                <h1 class="ts-section-title">Notifications</h1>
                <p class="ts-section-copy">Booking, ticket, event, transfer, resale and complaint updates.</p>
            </div><button class="ts-btn ts-btn-secondary" data-toast="All notifications marked as read">Mark All as
                Read</button>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title mb-16">Today</div>
            <div class="ts-list">
                <div class="ts-list-item">
                    <div class="flex gap-12"><span
                            class="ts-kpi-icon"><?=ts_icon('ticket')?></span>
                        <div>
                            <div class="ts-list-title">NFT ticket issued</div>
                            <div class="ts-list-sub">Aurora After Dark ticket TS-TK-100184 is now confirmed.</div>
                        </div>
                    </div>
                    <?=ts_status('New', 'info')?>
                </div>
                <div class="ts-list-item">
                    <div class="flex gap-12"><span
                            class="ts-kpi-icon"><?=ts_icon('check')?></span>
                        <div>
                            <div class="ts-list-title">Booking confirmed</div>
                            <div class="ts-list-sub">Booking TS20260001 was successfully created.</div>
                        </div>
                    </div><span class="small muted">4:05 PM</span>
                </div>
            </div>
            <div class="ts-card-title mt-24 mb-16">Earlier</div>
            <div class="ts-list">
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Resale listing active</div>
                        <div class="ts-list-sub">Midnight Resonance · VIP2 · C04</div>
                    </div><span class="small muted">Yesterday</span>
                </div>
                <div class="ts-list-item">
                    <div>
                        <div class="ts-list-title">Event reminder</div>
                        <div class="ts-list-sub">Velvet Hour Live begins in 7 days.</div>
                    </div><span class="small muted">12 Aug</span>
                </div>
            </div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Notifications', 'tickets', $content, '..', true);
?>