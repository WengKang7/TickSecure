<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="login.php" class="small secondary">← Back to Sign In</a>
<h1 class="ts-auth-title mt-24">Reset your password</h1>
<p class="ts-auth-sub">Enter the email registered to your TickSecure account.</p>
<div class="ts-auth-fields" id="forgot-form">
    <div class="ts-field">
        <label class="ts-label" for="reset-email">Email</label>
        <input class="ts-input" id="reset-email" type="email" name="resetEmail" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required>
    </div>
    <button class="ts-btn ts-btn-primary w-full" id="reset-btn" type="button">Send Reset Instructions</button>
</div>

<script type="module">
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { invokeTrustedBackend } from '<?=ts_asset_url('assets/js/backend-client.js', '..')?>';

function withResetTimeout(operation) {
    let timeout;
    return Promise.race([
        operation,
        new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('The request timed out. Check your connection and try again.')), 30000);
        })
    ]).finally(() => clearTimeout(timeout));
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('reset-btn');
    const form = document.getElementById('forgot-form');
    if (!btn || !form) return;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const V = window.tsValidation;
        if (!V) return;
        
        V.clearFieldErrors(form);
        const previousSuccess = form.querySelector('.ts-global-success');
        if (previousSuccess) previousSuccess.style.display = 'none';

        const emailEl = V.el(form, 'resetEmail');
        const ok = V.runAll([
            { check: () => V.validateRequired(V.val(form, 'resetEmail'), 'Email'), el: emailEl },
            { check: () => V.validateEmail(V.val(form, 'resetEmail')), el: emailEl }
        ]);
        if (!ok) return;

        const email = V.val(form, 'resetEmail').trim().toLowerCase();
        
        btn.disabled = true;
        btn.textContent = 'Checking email...';

        try {
            const result = await withResetTimeout(invokeTrustedBackend({ email }, {
                name: 'checkPasswordResetEmail', region: 'asia-southeast1',
                backend: ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ? 'php' : undefined
            }));
            if (result?.registered !== true) {
                V.showFieldError(emailEl, 'This email is not registered with TickSecure.');
                return;
            }
            btn.textContent = 'Sending...';
            await withResetTimeout(sendPasswordResetEmail(window.tsFirebase.auth, email));
            V.showGlobalSuccess(form, 'Success', 'Password reset instructions have been sent to your email.');
        } catch (err) {
            const notConfigured = ['functions/not-found', 'backend_not_configured', 'php_backend_disabled'].includes(err.code);
            const unavailable = ['functions/unavailable', 'functions/internal'].includes(err.code);
            const message = notConfigured
                ? "This site's password-reset service has not been configured yet. Please contact the site administrator."
                : unavailable
                    ? 'Account verification is temporarily unavailable. Please try again later.'
                : err.code === 'auth/user-not-found'
                    ? 'This email is not registered with TickSecure.'
                    : err.message || 'Unable to send reset instructions. Please try again.';
            V.showGlobalError(form, 'Reset unsuccessful', message);
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
