<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="login.php" class="small secondary">← Back to Sign In</a>
<h1 class="ts-auth-title mt-24">Reset your password</h1>
<p class="ts-auth-sub">Enter your registered email. If the account can be verified, reset instructions will be sent.</p>
<div class="ts-auth-fields" id="forgot-form">
    <div class="ts-field">
        <label class="ts-label">Email</label>
        <input class="ts-input" type="email" name="resetEmail" placeholder="you@example.com">
    </div>
    <button class="ts-btn ts-btn-primary w-full" id="reset-btn">Send Reset Instructions</button>
</div>

<script type="module">
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('reset-btn');
    const form = document.getElementById('forgot-form');
    if (!btn || !form) return;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        if (!V) return;
        
        V.clearFieldErrors(form);

        const emailEl = V.el(form, 'resetEmail');
        const ok = V.runAll([
            { check: () => V.validateRequired(V.val(form, 'resetEmail'), 'Email'), el: emailEl },
            { check: () => V.validateEmail(V.val(form, 'resetEmail')), el: emailEl }
        ]);
        if (!ok) return;

        const email = V.val(form, 'resetEmail');
        
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            await sendPasswordResetEmail(window.tsFirebase.auth, email);
            V.showGlobalSuccess(form, 'Success', 'Password reset instructions have been sent to your email.');
        } catch (err) {
            V.showGlobalError(form, 'Error', err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Reset Instructions';
        }
    });
});
</script>

<?php
$content=ob_get_clean();
render_auth_page('Forgot Password',$content,'..');
?>
