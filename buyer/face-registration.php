<?php require_once __DIR__ . '/../shared/ui.php'; ob_start(); ?>
<main class="ts-face-page ts-container">
  <a class="ts-record-back" href="tickets.php">&larr; My tickets</a>
  <header class="ts-record-heading"><div><div class="ts-section-eyebrow">Ticket identity</div><h1>Make it yours.</h1><p>Register your face after NFT confirmation. At the entrance, staff will check your QR and face together.</p></div></header>
  <div class="ts-alert ts-alert-error" id="face-error" role="alert" hidden></div>
  <div class="ts-face-layout">
    <section class="ts-card ts-face-card"><h2>Your face registration</h2><p id="face-status" role="status" aria-live="polite">Checking your ticket…</p>
      <video id="face-video" autoplay muted playsinline aria-label="Face registration camera preview"></video>
      <p>Look straight at the camera with your whole face visible. Face a light source, avoid glare on glasses and hold still for three quick captures.</p>
      <label class="ts-face-consent"><input type="checkbox" id="face-consent"> <span>I consent to an encrypted facial template being stored for this ticket and compared at entry. Camera images are discarded after processing. I am registering my own face.</span></label>
      <div class="ts-face-actions"><button class="ts-btn ts-btn-secondary" id="face-start" disabled>Start camera</button><button class="ts-btn ts-btn-primary" id="face-save" disabled>Register my face</button><button class="ts-btn ts-btn-secondary" id="face-stop" type="button">Stop camera</button></div>
      <a class="ts-btn ts-btn-primary" id="face-ticket" hidden href="tickets.php">Open my ticket</a>
    </section>
    <aside class="ts-card ts-face-card"><h2>What happens next</h2><ol><li>Complete NFT setup for this ticket.</li><li>Register your face to unlock its entry QR.</li><li>Open your ticket using your normal login.</li><li>At entry, show the QR and look at the check-in camera.</li></ol>
      <p>Use your own face for each ticket you own. To let another person attend, transfer the ticket first; they must register their face.</p>
      <h3>Your privacy</h3><p>Face data stays off the blockchain. Its template is deleted on transfer, resale, successful entry, or when you remove it here.</p>
      <p class="secondary">Local FYP demonstration. Face matching does not verify legal identity or provide certified liveness detection. Entrance staff must supervise the scan.</p>
      <button class="ts-btn ts-btn-secondary" id="face-remove" type="button" hidden>Remove my face registration</button><p class="small secondary">Removing registration disables this ticket’s QR until you register again.</p>
    </aside>
  </div>
</main>
<script src="<?=ts_asset_url('assets/js/face-client.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/face-registration.js', '..')?>"></script>
<?php $content = ob_get_clean(); render_public_page('Face registration', 'tickets', $content, '..', true); ?>
