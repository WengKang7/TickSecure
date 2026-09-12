<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<h1 class="ts-auth-title">Create a new password</h1>
<p class="ts-auth-sub">Use a strong password you have not used previously.</p>
<div class="ts-auth-fields" id="reset-form">
    <div class="ts-field">
        <label class="ts-label" for="new-password">New Password</label>
        <input class="ts-input" id="new-password" type="password" name="newPassword" autocomplete="new-password" maxlength="4096" placeholder="New password" required>
        <div class="ts-help">Use at least 8 characters with upper/lowercase, number and symbol.</div>
    </div>
    <div class="ts-field">
        <label class="ts-label" for="confirm-password">Confirm Password</label>
        <input class="ts-input" id="confirm-password" type="password" name="confirmPassword" autocomplete="new-password" maxlength="4096" placeholder="Repeat new password" required>
    </div>
    <button class="ts-btn ts-btn-primary w-full" id="update-btn" type="button">Update Password</button>
</div>

<script type="module">
import { confirmPasswordReset } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('update-btn');
    const form = document.getElementById('reset-form');
    if (!btn || !form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');

    if (!oobCode) {
        const V = window.tsValidation;
        if(V) V.showGlobalError(form, 'Error', 'Invalid or missing reset token.');
        btn.disabled = true;
        return;
    }

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const V = window.tsValidation;
        if (!V) return;
        
        V.clearFieldErrors(form);

        const pwEl = V.el(form, 'newPassword');
        const pw = V.val(form, 'newPassword');
        const cpw = V.val(form, 'confirmPassword');
        const cpwEl = V.el(form, 'confirmPassword');

        const ok = V.runAll([
            { check: () => V.validateRequired(pw, 'New Password'), el: pwEl },
            { check: () => V.validatePassword(pw), el: pwEl },
            { check: () => V.validateRequired(cpw, 'Confirm Password'), el: cpwEl }
        ]);

        if (!ok) return;

        if (pw !== cpw) {
            V.showFieldError(cpwEl, 'Passwords do not match');
            return;
        }
        
        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            await confirmPasswordReset(window.tsFirebase.auth, oobCode, pw);
            V.showGlobalSuccess(form, 'Success', 'Password has been updated. Redirecting to login...');
            setTimeout(() => window.location.href = 'login.php', 2000);
        } catch (err) {
            V.showGlobalError(form, 'Error', err.message);
            btn.disabled = false;
            btn.textContent = 'Update Password';
        }
    });
});
</script>
<?php
$content=ob_get_clean();
render_auth_page('Reset Password',$content,'..');
?>
