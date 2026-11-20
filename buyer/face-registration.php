<?php require_once __DIR__ . '/../shared/ui.php'; ob_start(); ?>
<main class="ts-face-page ts-face-registration ts-container">
  <a class="ts-record-back" href="tickets.php">&larr; My tickets</a>
  <header class="ts-face-registration-heading"><h1>Register your face</h1></header>
  <div class="ts-alert ts-alert-error" id="face-error" role="alert" hidden></div>
  <div class="ts-face-layout">
    <section class="ts-card ts-face-card" aria-label="Face registration">
      <div id="face-status" class="ts-face-instructions" data-ts-inline-feedback role="status" aria-live="polite" aria-busy="true"><span id="face-loading" class="ts-face-loading" aria-hidden="true"></span><span id="face-progress">Checking your ticket…</span></div>
      <div class="ts-face-camera"><video id="face-video" autoplay muted playsinline aria-label="Face registration camera preview"></video></div>
      <label class="ts-face-consent"><input type="checkbox" id="face-consent"> <span>I agree to store my encrypted face template for ticket entry.</span></label>
      <div class="ts-face-actions"><button class="ts-btn ts-btn-primary" id="face-save" disabled>Register my face</button></div>
      <section id="face-duplicate" class="ts-face-duplicate" hidden aria-labelledby="face-duplicate-title">
        <h2 id="face-duplicate-title">Face already linked to another ticket</h2>
        <p>One face can be registered to one active ticket per event. Scan again if this result is unexpected, or transfer this ticket so the recipient can register their own face.</p>
        <div class="ts-face-actions"><button class="ts-btn ts-btn-secondary" type="button" id="face-retry">Scan again</button><a class="ts-btn ts-btn-primary" id="face-transfer">Transfer this ticket</a></div>
      </section>
      <button class="ts-btn ts-btn-secondary" type="button" id="face-recheck" hidden>Check registration status</button>
      <a class="ts-btn ts-btn-primary" id="face-ticket" hidden href="tickets.php">Open my ticket</a>
      <button class="ts-btn ts-btn-secondary" id="face-remove" type="button" hidden>Remove registration</button>
      <details class="ts-face-privacy"><summary>Privacy details</summary><p>Register your own face. Camera images are discarded after processing. Your encrypted template is deleted after transfer, resale, entry, or removal. Removing it locks the ticket QR until you register again.</p></details>
    </section>
  </div>
</main>
<link rel="stylesheet" href="<?=ts_asset_url('assets/css/face-movement.css', '..')?>">
<script src="<?=ts_asset_url('assets/js/face-movement.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/face-client.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/face-registration.js', '..')?>"></script>
<?php $content = ob_get_clean(); render_public_page('Face registration', 'tickets', $content, '..', true); ?>
