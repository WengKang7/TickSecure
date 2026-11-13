<?php require_once __DIR__ . '/../shared/ui.php'; ob_start(); ?>
<main class="ts-face-page ts-face-registration ts-container">
  <a class="ts-record-back" href="tickets.php">&larr; My tickets</a>
  <header class="ts-face-registration-heading"><h1>Register your face</h1></header>
  <div class="ts-alert ts-alert-error" id="face-error" role="alert" hidden></div>
  <div class="ts-face-layout">
    <section class="ts-card ts-face-card" aria-label="Face registration">
      <div class="ts-face-camera"><video id="face-video" autoplay muted playsinline aria-label="Face registration camera preview"></video></div>
      <p id="face-status" role="status" aria-live="polite">Checking your ticket…</p>
      <label class="ts-face-consent"><input type="checkbox" id="face-consent"> <span>I agree to store my encrypted face template for ticket entry.</span></label>
      <div class="ts-face-actions"><button class="ts-btn ts-btn-secondary" id="face-start" disabled>Start camera</button><button class="ts-btn ts-btn-primary" id="face-save" disabled>Register my face</button><button class="ts-btn ts-btn-secondary" id="face-stop" type="button">Stop camera</button></div>
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
