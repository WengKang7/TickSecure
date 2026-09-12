<?php

function ts_icon(string $name, string $class = ''): string
{
    $paths = [
      'home' => '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
      'calendar' => '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      'ticket' => '<path d="M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 0 0-6V5H2z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
      'users' => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      'layout' => '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
      'chart' => '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
      'wallet' => '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M16 13h2"/>',
      'bell' => '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      'search' => '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      'plus' => '<path d="M12 5v14M5 12h14"/>',
      'chevron-down' => '<path d="m6 9 6 6 6-6"/>',
      'chevron-right' => '<path d="m9 18 6-6-6-6"/>',
      'arrow-right' => '<path d="M5 12h14M13 6l6 6-6 6"/>',
      'check' => '<path d="m5 12 4 4L19 6"/>',
      'x' => '<path d="M18 6 6 18M6 6l12 12"/>',
      'shield' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
      'lock' => '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      'map-pin' => '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      'filter' => '<path d="M4 5h16M7 12h10M10 19h4"/>',
      'more' => '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
      'upload' => '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
      'file' => '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/>',
      'layers' => '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
      'building' => '<path d="M4 21V5l8-3 8 3v16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M8 21v-4h8v4"/>',
      'activity' => '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
      'flag' => '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>',
      'message' => '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
      'download' => '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
      'eye' => '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      'edit' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      'trash' => '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
      'logout' => '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
      'menu' => '<path d="M4 7h16M4 12h16M4 17h16"/>',
      'copy' => '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
      'alert' => '<path d="M10.3 3.4 2.2 17.5A2 2 0 0 0 3.9 20h16.2a2 2 0 0 0 1.7-2.5L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
      'scanner' => '<path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3M7 12h10"/>',
      'settings' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H10v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V10h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3H14v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.3.3.5.7.6 1 .1.4.1.8 0 1.1v.1H21V15h-.1a1.7 1.7 0 0 0-1.5 0Z"/>',
    ];
    $p = $paths[$name] ?? $paths['more'];
    return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ts-icon '.htmlspecialchars($class).'">'.$p.'</svg>';
}

function ts_brand(string $base = '.'): string
{
    return '<a class="ts-brand" href="'.$base.'/index.php"><span class="ts-brand-mark"></span><span>TickSecure</span></a>';
}

function ts_status(string $text, string $tone = 'neutral'): string
{
    return '<span class="ts-chip ts-chip-'.htmlspecialchars($tone).'">'.htmlspecialchars($text).'</span>';
}

function ts_modal_and_toast(): string
{
    return '<div class="ts-modal-backdrop" id="confirm-modal"><div class="ts-modal"><div class="ts-modal-head"><div><div class="ts-modal-title">UI preview action</div><div class="secondary mt-8">This codebase is UI-only. No backend action will be submitted yet.</div></div><button class="ts-icon-btn" data-modal-close aria-label="Close">'.ts_icon('x').'</button></div><div class="ts-modal-actions"><button class="ts-btn ts-btn-secondary" data-modal-close>Cancel</button><button class="ts-btn ts-btn-primary" data-modal-close data-toast="Action confirmed in UI preview">Confirm</button></div></div></div><div class="ts-toast">'.ts_icon('check').'<span>Saved</span></div>';
}

function render_public_page(string $title, string $active, string $content, string $base = '.', bool $buyerLogged = true): void
{
    $eventActive = $active === 'events' ? 'active' : '';
    $resaleActive = $active === 'resale' ? 'active' : '';
    $ticketsActive = $active === 'tickets' ? 'active' : '';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.htmlspecialchars($title).' · TickSecure</title><link rel="stylesheet" href="'.$base.'/assets/css/ticksecure.css"></head><body class="ts-body-public">';
    echo '<header class="ts-public-header"><div class="ts-public-header-inner"><div class="flex items-center">'.ts_brand($base).'<nav class="ts-public-nav"><a class="'.$eventActive.'" href="'.$base.'/public/events.php">Events</a><a class="'.$resaleActive.'" href="'.$base.'/public/resale.php">Resale</a><a class="'.$ticketsActive.'" href="'.$base.'/buyer/tickets.php">My Tickets</a><a href="'.$base.'/buyer/complaints.php">Help</a></nav></div><div class="ts-public-actions"><button class="ts-icon-btn" aria-label="Search">'.ts_icon('search').'</button>';
    if ($buyerLogged) {
        echo '<a class="ts-wallet-mini" href="'.$base.'/buyer/wallet.php"><span class="ts-wallet-dot"></span>'.ts_icon('wallet').'0x12A4…8F92</a><a class="ts-icon-btn" href="'.$base.'/buyer/notifications.php" aria-label="Notifications">'.ts_icon('bell').'</a><a class="ts-avatar" href="'.$base.'/buyer/profile.php">GH</a>';
    } else {
        echo '<a class="ts-btn ts-btn-secondary ts-btn-sm" href="'.$base.'/auth/login.php">Sign in</a><a class="ts-btn ts-btn-primary ts-btn-sm" href="'.$base.'/auth/register.php">Create account</a>';
    }
    echo '<button class="ts-icon-btn ts-mobile-menu-btn">'.ts_icon('menu').'</button></div></div></header>'.$content.ts_modal_and_toast().'<script type="module" src="'.$base.'/assets/js/firebase-init.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firebase-services.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firestore-crud.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/validation.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/auth-guard.js?v='.time().'"></script><script src="'.$base.'/assets/js/ui.js?v='.time().'"></script></body></html>';
}

function ts_sidebar_links(string $role, string $active, string $base): string
{
    $groups = [];
    if ($role === 'organizer') {
        $groups = [
          'Overview' => [['dashboard','Dashboard','home','dashboard.php']],
          'Event Management' => [['events','My Events','calendar','events.php'],['create','Create Event','plus','event-new.php']],
          'Sales' => [['sales','Sales & Revenue','chart','sales.php'],['nft','NFT Tickets','ticket','nft.php'],['attendees','Attendees','users','attendees.php'],['secondary','Secondary Market','activity','secondary-market.php']],
          'Support' => [['complaints','Complaints','message','complaints.php'],['notifications','Notifications','bell','notifications.php']],
          'Account' => [['profile','Organization Profile','building','profile.php']]
        ];
    } elseif ($role === 'admin') {
        $groups = [
          'Overview' => [['dashboard','Dashboard','home','dashboard.php']],
          'Management' => [['users','Users','users','users.php'],['organizers','Organizer Applications','building','organizers.php'],['events','Events','calendar','events.php'],['venues','Venues & Layouts','layout','venues.php']],
          'Monitoring' => [['blockchain','Blockchain Transactions','activity','blockchain.php'],['resale','Resale Monitoring','ticket','resale.php'],['audit','Audit Logs','shield','audit.php']],
          'Support & Governance' => [['complaints','Complaints','message','complaints.php'],['reports','Reports','file','reports.php']],
          'Account' => [['profile','Profile','user','profile.php']]
        ];
    } else {
        return '';
    }
    $html = '';
    foreach ($groups as $label => $items) {
        $html .= '<div class="ts-nav-group"><div class="ts-nav-label">'.htmlspecialchars($label).'</div>';
        foreach ($items as $it) {
            [$key,$label2,$icon,$file] = $it;
            $html .= '<a class="ts-side-link '.($active === $key ? 'active' : '').'" href="'.$base.'/'.$role.'/'.$file.'">'.ts_icon($icon).'<span>'.$label2.'</span></a>';
        }$html .= '</div>';
    }
    return $html;
}

function render_dashboard_page(string $role, string $title, string $active, string $content, string $base = '..', string $breadcrumb = ''): void
{
    $roleName = $role === 'admin' ? 'Administrator' : 'Event Organizer';
    $initial = $role === 'admin' ? 'AD' : 'NS';
    $person = $role === 'admin' ? 'Admin Account' : 'Nova Stage';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.htmlspecialchars($title).' · TickSecure</title><link rel="stylesheet" href="'.$base.'/assets/css/ticksecure.css"></head><body class="ts-body-dashboard"><div class="ts-shell">';
    echo '<aside class="ts-sidebar"><div class="ts-sidebar-head">'.ts_brand($base).'</div><nav class="ts-sidebar-nav">'.ts_sidebar_links($role, $active, $base).'</nav><div class="ts-sidebar-foot"><div class="ts-profile-card"><div class="ts-avatar" id="sidebar-avatar">'.$initial.'</div><div class="ts-profile-meta"><div class="ts-profile-name" id="sidebar-name">'.$person.'</div><div class="ts-profile-role">'.$roleName.'</div></div></div></div></aside>';
    echo '<main class="ts-main"><header class="ts-dashboard-header"><div class="flex items-center gap-12"><button class="ts-icon-btn ts-sidebar-toggle">'.ts_icon('menu').'</button><div><div class="ts-breadcrumb">'.htmlspecialchars($breadcrumb ?: $roleName).'</div><div class="ts-dashboard-title">'.htmlspecialchars($title).'</div></div></div><div class="ts-dashboard-actions"><button class="ts-icon-btn">'.ts_icon('search').'</button><button class="ts-icon-btn">'.ts_icon('bell').'</button><span class="ts-role-pill">'.$roleName.'</span><div class="ts-avatar" id="header-avatar">'.$initial.'</div><button class="ts-icon-btn ts-logout-btn" title="Log out" style="margin-left: 10px;">'.ts_icon('logout').'</button></div></header><div class="ts-page">'.$content.'</div></main></div>'.ts_modal_and_toast().'<script type="module" src="'.$base.'/assets/js/firebase-init.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firebase-services.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firestore-crud.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/validation.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/auth-guard.js?v='.time().'"></script><script src="'.$base.'/assets/js/ui.js?v='.time().'"></script><script type="module">document.querySelector(".ts-logout-btn")?.addEventListener("click", () => { window.tsAuth.logout(); });</script></body></html>';
}

function render_auth_page(string $title, string $content, string $base = '..'): void
{
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.htmlspecialchars($title).' · TickSecure</title><link rel="stylesheet" href="'.$base.'/assets/css/ticksecure.css"></head><body><div class="ts-auth"><section class="ts-auth-art"><div style="position:relative;z-index:2">'.ts_brand($base).'</div><div class="ts-auth-copy"><div class="ts-section-eyebrow" style="color:#D5B98E">Verified. Traceable. Fair.</div><h1>Premium ticketing with ownership you can trust.</h1><p>TickSecure keeps the buying experience familiar while verified NFT ownership, controlled resale and single-use entry protection work quietly in the background.</p></div><div class="ts-auth-trust"><span>✓ Verified ownership</span><span>✓ Controlled resale</span><span>✓ Secure entry</span></div></section><main class="ts-auth-form-wrap"><div class="ts-auth-form">'.$content.'</div></main></div>'.ts_modal_and_toast().'<script type="module" src="'.$base.'/assets/js/firebase-init.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firebase-services.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/firestore-crud.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/validation.js?v='.time().'"></script><script type="module" src="'.$base.'/assets/js/auth-guard.js?v='.time().'"></script><script src="'.$base.'/assets/js/ui.js?v='.time().'"></script></body></html>';
}

function ts_page_head(string $title, string $subtitle = '', string $actions = ''): string
{
    return '<div class="ts-page-head"><div><h1 class="ts-page-title">'.htmlspecialchars($title).'</h1>'.($subtitle ? '<p class="ts-page-subtitle">'.htmlspecialchars($subtitle).'</p>' : '').'</div>'.($actions ? '<div class="ts-page-actions">'.$actions.'</div>' : '').'</div>';
}

function ts_kpi(string $label, string $value, string $icon = 'chart', string $delta = ''): string
{
    return '<div class="ts-card ts-kpi"><div class="ts-kpi-top"><span>'.$label.'</span><span class="ts-kpi-icon">'.ts_icon($icon).'</span></div><div class="ts-kpi-value">'.$value.'</div><div class="ts-kpi-label">Current platform view</div>'.($delta ? '<div class="ts-kpi-delta">'.$delta.'</div>' : '').'</div>';
}

/*
|--------------------------------------------------------------------------
| UI Preview Venue Data
|--------------------------------------------------------------------------
| Temporary mock venue data.
| Later these values will come from Firebase / Firestore.
|--------------------------------------------------------------------------
*/

function ts_venue_catalog(): array
{
    return [

        'merdeka-hall' => [

            'venueId' => 'merdeka-hall',

            'name' => 'Merdeka Hall',

            'location' => 'Kuala Lumpur',

            'layoutStatus' => 'ACTIVE',

            'capacity' => 120,

            'sections' => [

                [
                    'sectionId' => 'A',
                    'name' => 'Section A',
                    'seatCount' => 20,

                    'geometry' => [
                        'left' => 8,
                        'top' => 28,
                        'width' => 35,
                        'height' => 25
                    ]
                ],

                [
                    'sectionId' => 'B',
                    'name' => 'Section B',
                    'seatCount' => 40,

                    'geometry' => [
                        'left' => 57,
                        'top' => 28,
                        'width' => 35,
                        'height' => 25
                    ]
                ],

                [
                    'sectionId' => 'C',
                    'name' => 'Section C',
                    'seatCount' => 60,

                    'geometry' => [
                        'left' => 18,
                        'top' => 65,
                        'width' => 64,
                        'height' => 25
                    ]
                ]

            ]

        ],


        /*
        |--------------------------------------------------------------------------
        | Second Venue
        | Used only to demonstrate that changing the dropdown
        | changes the venue layout.
        |--------------------------------------------------------------------------
        */

        'axiata-arena' => [

            'venueId' => 'axiata-arena',

            'name' => 'Axiata Arena',

            'location' => 'Bukit Jalil',

            'layoutStatus' => 'ACTIVE',

            'capacity' => 110,

            'sections' => [

                [
                    'sectionId' => 'A',
                    'name' => 'Lower Left',
                    'seatCount' => 30,

                    'geometry' => [
                        'left' => 6,
                        'top' => 30,
                        'width' => 27,
                        'height' => 30
                    ]
                ],

                [
                    'sectionId' => 'B',
                    'name' => 'Floor',
                    'seatCount' => 50,

                    'geometry' => [
                        'left' => 36,
                        'top' => 30,
                        'width' => 28,
                        'height' => 45
                    ]
                ],

                [
                    'sectionId' => 'C',
                    'name' => 'Lower Right',
                    'seatCount' => 30,

                    'geometry' => [
                        'left' => 67,
                        'top' => 30,
                        'width' => 27,
                        'height' => 30
                    ]
                ]

            ]

        ]

    ];
}


/*
|--------------------------------------------------------------------------
| Reusable Venue Layout Renderer
|--------------------------------------------------------------------------
|
| organizer:
|   Section A
|   20 seats
|
| buyer:
|   VIP1
|   Section A
|   RM688
|
|--------------------------------------------------------------------------
*/

function ts_render_venue_layout(
    string $venueId,
    string $mode = 'organizer',
    array $categoryMap = []
): string {

    $venues = ts_venue_catalog();

    if (!isset($venues[$venueId])) {
        return '';
    }

    $venue = $venues[$venueId];

    ob_start();

    ?>

    <div class="ts-reusable-venue">

        <div class="flex justify-between items-center mb-20">

            <div>

                <div class="ts-card-title">
                    <?= htmlspecialchars($venue['name']) ?>
                </div>

                <div class="ts-card-sub">
                    <?= htmlspecialchars($venue['location']) ?>
                    ·
                    <?= $venue['capacity'] ?> seats
                    ·
                    <?= count($venue['sections']) ?> sections
                </div>

            </div>

            <?= ts_status('Layout Active', 'success') ?>

        </div>


        <div class="ts-reusable-venue-plan">

            <!-- STAGE -->

            <div class="ts-reusable-stage">
                STAGE
            </div>


            <?php foreach ($venue['sections'] as $section): ?>

                <?php

                $geometry = $section['geometry'];

                $style = sprintf(
                    'left:%s%%; top:%s%%; width:%s%%; height:%s%%;',
                    $geometry['left'],
                    $geometry['top'],
                    $geometry['width'],
                    $geometry['height']
                );

                $sectionId = $section['sectionId'];

                ?>


                <div
                    class="ts-reusable-section"
                    style="<?= $style ?>"
                >

                    <div class="ts-reusable-section-content">


                        <?php if (
                            $mode === 'buyer'
                            && isset($categoryMap[$sectionId])
                        ): ?>

                            <?php
                            $category = $categoryMap[$sectionId];
                            ?>

                            <strong>
                                <?= htmlspecialchars($category['name']) ?>
                            </strong>

                            <span>
                                <?= htmlspecialchars($section['name']) ?>
                            </span>

                            <span class="ts-layout-price">
                                <?= htmlspecialchars($category['price']) ?>
                            </span>


                        <?php else: ?>


                            <strong>
                                <?= htmlspecialchars($section['name']) ?>
                            </strong>

                            <span>
                                <?= $section['seatCount'] ?> seats
                            </span>


                        <?php endif; ?>


                    </div>

                </div>


            <?php endforeach; ?>

        </div>

    </div>

    <?php

    return ob_get_clean();
}
