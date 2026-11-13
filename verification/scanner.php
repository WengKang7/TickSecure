<?php require_once __DIR__ . '/../shared/ui.php'; $faceMachine = ($faceMachine ?? false) === true; ?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Identity check-in · TickSecure</title><link rel="stylesheet" href="../assets/css/ticksecure.css"><?=ts_access_head('..')?><?=ts_decision_head('..')?><?=ts_design2_theme_head('..')?></head>
<body><main class="ts-face-page ts-container <?= $faceMachine ? 'ts-face-machine' : '' ?>">
  <?=ts_brand('..')?>
  <header class="ts-record-heading"><div><div class="ts-section-eyebrow">Event entrance</div><h1>Identity check-in.</h1><p>Scan the ticket QR, confirm consent and look at the camera. A successful face match checks the attendee in and marks the ticket used.</p></div></header>
  <div class="ts-face-layout">
    <section class="ts-card ts-face-card"><h2 id="checkin-step">1. Scan ticket QR</h2>
      <div class="ts-face-camera"><video id="checkin-video" autoplay muted playsinline aria-label="Check-in camera preview"></video><?php if ($faceMachine): ?><div class="ts-face-guide" aria-hidden="true"></div><span class="ts-face-camera-label">LIVE CAMERA</span><?php endif; ?></div>
      <p id="checkin-status" role="status" aria-live="polite">Sign in as the event organizer or an administrator to begin.</p>
      <div class="ts-alert ts-alert-error ts-face-result" id="checkin-error" role="alert" tabindex="-1" hidden></div>
      <div class="ts-alert ts-alert-success ts-face-result" id="checkin-success" role="status" tabindex="-1" hidden>
        <strong>Verification successful</strong>
        <p id="checkin-success-message"></p>
        <dl class="ts-face-receipt">
          <div><dt>Event</dt><dd id="checkin-result-event"></dd></div>
          <div><dt>Attendee / current owner</dt><dd id="checkin-result-attendee"></dd></div>
          <div><dt>Ticket category</dt><dd id="checkin-result-category"></dd></div>
          <div><dt>Section</dt><dd id="checkin-result-section"></dd></div>
          <div><dt>Seat</dt><dd id="checkin-result-seat"></dd></div>
          <div><dt>Ticket reference</dt><dd id="checkin-result-ticket"></dd></div>
          <div><dt>Checked in at (Malaysia time)</dt><dd id="checkin-result-time"></dd></div>
          <div><dt>Entry status</dt><dd id="checkin-result-status"></dd></div>
        </dl>
      </div>
      <label class="ts-face-consent" id="checkin-supervision" hidden><input id="checkin-present" type="checkbox"><span>The attendee is physically present in front of this camera and agrees to a face check. I am not scanning a photograph or video.</span></label>
      <p id="checkin-hint" class="ts-face-hint" role="status" hidden></p>
      <div class="ts-face-actions"><button class="ts-btn ts-btn-primary" id="checkin-qr" disabled>Scan QR with camera</button><button class="ts-btn ts-btn-secondary" id="checkin-face" hidden>Start face camera</button><button class="ts-btn ts-btn-secondary" id="checkin-reset">Next attendee / reset</button></div>
      <details class="mt-24"><summary>Enter QR text manually</summary><label for="qr-input">Ticket QR payload</label><textarea class="ts-input mt-12" id="qr-input" maxlength="512" placeholder="Paste the complete TKSECURE2 QR payload"></textarea><button class="ts-btn ts-btn-secondary mt-12" id="verify-btn" disabled>Check QR</button></details>
    </section>
    <aside class="ts-card ts-face-card"><h2>How to check in</h2><ol><li>The buyer completes NFT setup and registers their face from My Tickets.</li><li>As the event organizer or administrator, scan the buyer’s ticket QR or paste its full QR text.</li><li>Start the face camera and confirm the attendee’s presence and consent. Follow the five head movement directions; green face points indicate the correct angle. Each step is captured automatically.</li><li>A successful match marks the ticket used and prevents duplicate entry. Select Next attendee for the next ticket.</li></ol><p><strong>Successful:</strong> the face matches the current registered ticket owner and check-in is complete.<br><strong>Failed:</strong> check-in was not confirmed. Read the message and scan the ticket again before retrying.</p>
      <p>A QR check alone does not admit anyone. Failed face checks do not mark tickets used.</p>
      <p class="secondary">Supervised local FYP demonstration. This face matcher does not provide certified liveness or legal identity verification. Do not admit someone using a photograph or video.</p>
      <a class="ts-btn ts-btn-secondary" href="../index.php">Back to TickSecure</a>
    </aside>
  </div>
</main>
<script type="module" src="../assets/js/firebase-init.js"></script>
<script type="module" src="<?=ts_asset_url('assets/js/auth-guard.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/vendor/jsQR-1.4.0.js', '..')?>"></script>
<link rel="stylesheet" href="<?=ts_asset_url('assets/css/face-movement.css', '..')?>">
<script src="<?=ts_asset_url('assets/js/face-movement.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/face-client.js', '..')?>"></script>
<script src="<?=ts_asset_url('assets/js/face-checkin.js', '..')?>"></script>
</body></html>
