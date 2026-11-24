<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="text-center">
    <div id="verification-icon" class="ts-success-icon" style="background:var(--brand-100);color:var(--brand-900)">
        <span id="verification-mail"><?=ts_icon('mail', 'ts-icon-xl')?></span>
        <span id="verification-tick" hidden><?=ts_icon('check', 'ts-icon-xl')?></span>
    </div>
    <h1 class="ts-auth-title" id="verification-heading">Verify your email</h1>
    <p class="ts-auth-sub" id="verification-description">We sent a verification link to <strong id="verification-email">your email address</strong>.
        Open the link. This page will update automatically.</p>
    <div id="verification-progress" class="small muted mb-16" aria-live="polite"></div>
    <button class="ts-btn ts-btn-primary w-full" id="verification-complete" type="button">I verified my email</button>
    <button class="ts-btn ts-btn-secondary w-full mt-8" id="verification-resend" type="button" disabled>Resend in 60s</button>
    <a class="ts-btn ts-btn-tertiary w-full mt-8" id="verification-return" href="login.php">Return to Sign In</a>
</div>

<script type="module">
    document.addEventListener('DOMContentLoaded', () => {
        const emailLabel = document.getElementById('verification-email');
        const message = document.getElementById('verification-progress');
        const completeButton = document.getElementById('verification-complete');
        const resendButton = document.getElementById('verification-resend');
        const returnButton = document.getElementById('verification-return');
        const emailFromUrl = new URLSearchParams(window.location.search).get('email');
        const RESEND_DELAY = 60 * 1000;
        let cooldownKey = '';
        let resendAt = 0;
        let sending = false;

        const updateResendButton = () => {
            const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
            resendButton.disabled = sending || !cooldownKey || seconds > 0;
            resendButton.textContent = sending ? 'Sending verification email...'
                : seconds > 0 ? `Resend in ${seconds}s` : 'Resend verification email';
        };
        const startCooldown = () => {
            resendAt = Date.now() + RESEND_DELAY;
            try { localStorage.setItem(cooldownKey, String(resendAt)); } catch (_) { /* Keep the timer in memory if storage is unavailable. */ }
            updateResendButton();
        };
        const restoreCooldown = email => {
            if (!email) return;
            const key = `ticksecure:verification-resend:${email.trim().toLowerCase()}`;
            if (key === cooldownKey) return;
            cooldownKey = key;
            let saved = 0;
            try { saved = Number(localStorage.getItem(key)); } catch (_) { /* Use an in-memory timer instead. */ }
            if (Number.isFinite(saved) && saved > 0) resendAt = saved;
            else startCooldown();
            updateResendButton();
        };
        const cooldownTimer = window.setInterval(updateResendButton, 1000);
        let finished = false, checking = false, leaving = false, stopped = false;
        let checkTimer = null, redirectTimer = null;
        window.addEventListener('storage', event => {
            if (event.key !== cooldownKey || !event.newValue) return;
            const saved = Number(event.newValue);
            if (Number.isFinite(saved) && saved > 0) resendAt = saved;
            updateResendButton();
        });
        
        const currentUser = () => window.tsFirebase?.auth?.currentUser || null;
        const updateEmailLabel = (user = currentUser() || window.tsCurrentUser) => {
            emailLabel.textContent = user?.email || emailFromUrl || 'your email address';
            restoreCooldown(user?.email || emailFromUrl);
        };

        updateEmailLabel();
        window.addEventListener('ts-auth-ready', event => updateEmailLabel(event.detail));

        const checkVerification = async (manual = false) => {
            if (finished || checking || leaving || stopped || (!manual && document.hidden)) return;
            const user = currentUser();
            if (!user || !window.tsAuth) return;
            const expectedUid = user.uid;
            const sameSession = () => !stopped && !leaving && currentUser()?.uid === expectedUid;
            checking = true;
            completeButton.disabled = true;
            if (manual) message.textContent = 'Checking verification status...';
            try {
                // Poll Auth only. Do not repeatedly read Firestore while waiting.
                await user.reload();
                if (!sameSession()) return;
                if (!user.emailVerified) {
                    if (manual) message.textContent = 'Your email is not verified yet. Open the latest verification link in your email.';
                    return;
                }
                const verified = await window.tsAuth.syncEmailVerification();
                if (!verified || !sameSession()) return;
                // Keep the existing requirement to sign in again after verification.
                await window.tsAuth.logout();
                if (stopped || leaving) return;
                finished = true;
                window.clearInterval(checkTimer);
                window.clearInterval(cooldownTimer);
                document.getElementById('verification-mail').hidden = true;
                document.getElementById('verification-tick').hidden = false;
                const icon = document.getElementById('verification-icon');
                icon.style.background = 'var(--success-bg, #ecfdf3)';
                icon.style.color = 'var(--success, #067647)';
                document.getElementById('verification-heading').textContent = 'Email verified';
                document.getElementById('verification-description').textContent = 'Your email has been verified successfully.';
                message.textContent = 'Redirecting to sign in...';
                completeButton.hidden = true;
                resendButton.hidden = true;
                returnButton.textContent = 'Continue to Sign In';
                redirectTimer = window.setTimeout(() => {
                    if (!stopped && !leaving) window.location.replace('login.php?verified=1');
                }, 1500);
            } catch (error) {
                if (sameSession()) message.textContent = error?.message === 'internal'
                    ? 'Unable to update verification status. Please try again.'
                    : manual ? error?.message || 'Unable to check verification. Please try again.'
                    : 'Unable to check automatically. Reconnect or use “I verified my email”.';
            } finally {
                checking = false;
                if (!finished && !leaving) completeButton.disabled = false;
            }
        };
        const checkWhenVisible = () => { if (!document.hidden) void checkVerification(); };
        checkTimer = window.setInterval(checkWhenVisible, 5000);
        window.addEventListener('focus', checkWhenVisible);
        window.addEventListener('online', checkWhenVisible);
        window.addEventListener('ts-auth-ready', checkWhenVisible);
        document.addEventListener('visibilitychange', checkWhenVisible);
        window.addEventListener('pagehide', () => {
            stopped = true;
            window.clearInterval(checkTimer);
            window.clearInterval(cooldownTimer);
            window.clearTimeout(redirectTimer);
        });
        window.addEventListener('pageshow', event => {
            if (event.persisted) window.location.reload();
        });
        void checkVerification();

        resendButton?.addEventListener('click', async () => {
            if (finished || leaving || sending || !cooldownKey || Date.now() < resendAt) return;
            sending = true;
            startCooldown();
            message.textContent = 'Sending verification email...';
            try {
                await window.tsAuth.resendVerificationEmail();
                if (!finished && !leaving) message.textContent = 'Verification email sent. Check your inbox and spam folder.';
            } catch (error) {
                if (finished || leaving) return;
                message.textContent = error?.code === 'auth/too-many-requests'
                    ? 'Too many requests. Please wait and try again later. You can also check your inbox and spam folder for an earlier verification email.'
                    : error?.message || 'Unable to resend the verification email.';
            } finally {
                sending = false;
                startCooldown();
            }
        });

        completeButton?.addEventListener('click', () => checkVerification(true));

        returnButton?.addEventListener('click', async (event) => {
            event.preventDefault();
            leaving = true;
            window.clearInterval(checkTimer);
            window.clearTimeout(redirectTimer);
            returnButton.setAttribute('aria-disabled', 'true');
            returnButton.style.pointerEvents = 'none';
            message.textContent = 'Returning to sign in...';
            try {
                const user = currentUser();
                if (user) {
                    await window.tsAuth.logout();
                }
            } catch (error) {
                // Always preserve the escape route to sign-in. Syncing the
                // profile is deliberately handled by the "I verified" action or
                // by the next successful sign-in, so an unavailable backend can
                // never trap a verified user on this page.
                try {
                    await window.tsAuth.logout();
                } catch (_) {
                    /* no-op */ }
            }
            window.location.replace(finished ? 'login.php?verified=1' : 'login.php');
        });
    });
</script>

<?php
$content = ob_get_clean();
render_auth_page('Verify Email', $content, '..');
?>
