<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-buyer-notifications-page">
  <div class="ts-container">
    <div class="ts-section-title-row">
      <div><div class="ts-section-eyebrow">Your updates</div><h1 class="ts-section-title">Notifications</h1><p class="ts-section-copy">Booking, ticket, event and resale updates, all in one place.</p></div>
      <div class="ts-notification-toolbar"><button class="ts-btn ts-btn-secondary" type="button" id="btn-refresh-notifications">Refresh</button><button class="ts-btn ts-btn-primary" type="button" id="btn-mark-all" disabled>Mark all as read</button></div>
    </div>
    <p class="small secondary mb-20" id="notification-status" role="status" aria-live="polite">Loading your notifications...</p>
    <div class="ts-alert ts-alert-error mb-20" id="notification-error" role="alert" hidden></div>
    <div class="ts-card" id="notif-container" aria-busy="true"><p class="secondary ts-card-pad">Loading your notifications...</p></div>
  </div>
</main>
<?php
$content = ob_get_clean();
render_public_page('Notifications', 'notifications', $content, '..', true);
?>
