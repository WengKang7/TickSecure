<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="text-center">
    <div class="ts-success-icon" style="background:var(--brand-100);color:var(--brand-900)">
        <?=ts_icon('mail', 'ts-icon-xl')?>
    </div>
    <h1 class="ts-auth-title">Verify your email</h1>
    <p class="ts-auth-sub">We sent a verification link to <strong id="verification-email">your email address</strong>.
        Open it, then return here to continue.</p>
    <div id="verification-message" class="small muted mb-16" aria-live="polite"></div>
    <button class="ts-btn ts-btn-primary w-full" id="verification-complete" type="button">I verified my email</button>
    <button class="ts-btn ts-btn-secondary w-full mt-8" id="verification-resend" type="button" disabled>Resend in 60s</button>
    <a class="ts-btn ts-btn-tertiary w-full mt-8" id="verification-return" href="login.php">Return to Sign In</a>
</div>

<script type="module">
    document.addEventListener('DOMContentLoaded', () => {
        const emailLabel = document.getElementById('verification-email');
        const message = document.getElementById('verification-message');
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
        window.setInterval(updateResendButton, 1000);
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

        const syncVerifiedEmail = async () => {
            const user = currentUser();
            if (!user) throw new Error('Your sign-in session has ended. Please sign in again.');
            await user.reload();
            updateEmailLabel(user);
            const verified = await window.tsAuth.syncEmailVerification();
            if (!verified) return {
                verified: false,
                profile: null
            };
            const profile = await window.tsDb.getUserProfile(user.uid);
            if (!profile) throw new Error(
                'Your user profile could not be found. Please contact support.');
            return {
                verified: true,
                profile
            };
        };

        resendButton?.addEventListener('click', async () => {
            if (sending || !cooldownKey || Date.now() < resendAt) return;
            sending = true;
            startCooldown();
            message.textContent = 'Sending verification email...';
            try {
                await window.tsAuth.resendVerificationEmail();
                message.textContent = 'Verification email sent. Check your inbox and spam folder.';
            } catch (error) {
                message.textContent = error?.code === 'auth/too-many-requests'
                    ? 'Too many requests. Please wait and try again later. You can also check your inbox and spam folder for an earlier verification email.'
                    : error?.message || 'Unable to resend the verification email.';
            } finally {
                sending = false;
                startCooldown();
            }
        });

        completeButton?.addEventListener(
    'click',
    async () => {

        completeButton.disabled = true;

        message.textContent =
            'Checking verification status...';


        try {

            const {
                verified,
                profile
            } = await syncVerifiedEmail();


            // ==========================================
            // NOT VERIFIED
            // ==========================================

            if (!verified) {

                message.textContent =
                    'Your email is not verified yet. ' +
                    'Open the latest verification link ' +
                    'in your email, then try again.';

                return;
            }


            // ==========================================
            // VERIFIED SUCCESSFULLY
            // ==========================================

            message.textContent =
                'Email verified successfully. ' +
                'Redirecting you to sign in...';


            // Important:
            // Verification should NOT automatically
            // authenticate the user into TickSecure.
            await window.tsAuth.logout();


            // Return to login.
            // verified=1 displays a success message.
            window.location.replace(
                'login.php?verified=1'
            );


        } catch (error) {

            const detail =
                error?.message
                || 'Unable to sync verification status.';


            message.textContent =
                detail === 'internal'
                    ? 'Your email is verified, but TickSecure could not update your account record. Please try again.'
                    : detail;


        } finally {

            completeButton.disabled = false;

        }

    }
);

        returnButton?.addEventListener('click', async (event) => {
            event.preventDefault();
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
            window.location.replace('login.php');
        });
    });
</script>

<?php
$content = ob_get_clean();
render_auth_page('Verify Email', $content, '..');
?>
