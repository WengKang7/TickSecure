<?php require_once __DIR__ . '/../shared/ui.php'; ?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entry Verification · TickSecure</title><link rel="stylesheet" href="../assets/css/ticksecure.css"></head><body><main class="ts-verify-shell"><div class="ts-verify-card"><div class="flex justify-between items-center mb-24"><div><?=ts_brand('..')?><div class="small" style="color:#98A2B3;margin-top:8px">Authorized Event Personnel · Aurora After Dark</div></div><?=ts_status('Ready','success')?></div><div class="ts-camera"><div class="ts-camera-corners"></div><div class="text-center"><?=ts_icon('scanner','ts-icon-xl')?><div class="mt-12">QR camera area</div><div class="small mt-8">Ready to scan attendee ticket</div></div></div>

<div class="mt-20">
    <div class="ts-input-wrap flex gap-12" style="margin-bottom: 20px;">
        <input class="ts-input grow" type="text" name="qrInput" id="qr-input" placeholder="Simulate QR data (TKSECURE:tId:eId:sId)">
        <button class="ts-btn ts-btn-primary" id="verify-btn">Verify</button>
    </div>
    <div class="grid-2 flex gap-12">
        <a class="ts-btn ts-btn-success grow" href="valid.php">Preview Valid Result</a>
        <a class="ts-btn ts-btn-danger grow" href="invalid.php">Preview Invalid Result</a>
    </div>
</div>

<script type="module" src="../assets/js/firebase-init.js"></script>
<script type="module" src="../assets/js/auth-guard.js"></script>
<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('verify-btn');
    const input = document.getElementById('qr-input');
    
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
        const val = input.value.trim();
        if (!val) return;

        btn.disabled = true;
        btn.textContent = 'Verifying...';

        try {
            // Expected format: TKSECURE:ticketId:eventId:seatId
            const parts = val.split(':');
            if (parts.length < 4 || parts[0] !== 'TKSECURE') {
                throw new Error('Invalid QR format');
            }

            const ticketId = parts[1];
            const eventId = parts[2];
            // verifyTicket(ticketId, eventId)
            
            // Note: In real app, we need auth-ready, but this is a tool for personnel.
            // Let's assume window.tsTickets is loaded via auth-guard/init.
            // Wait for window.tsTickets to be available
            if(!window.tsTickets) {
                throw new Error('Services not initialized. Are you logged in as personnel?');
            }
            
            const result = await window.tsTickets.verifyTicket(ticketId, eventId);
            if (result && result.valid) {
                window.location.href = `valid.php?ticketId=${encodeURIComponent(ticketId)}`;
            } else {
                throw new Error(result.reason || 'Invalid ticket');
            }
        } catch (err) {
            window.location.href = `invalid.php?reason=${encodeURIComponent(err.message)}`;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verify';
        }
    });
});
</script>

</div></main></body></html>