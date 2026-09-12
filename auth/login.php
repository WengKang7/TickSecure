<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="../index.php" class="small secondary">← Back to TickSecure</a><h1 class="ts-auth-title mt-24">Welcome back</h1><p class="ts-auth-sub">Sign in to continue to your TickSecure account.</p>
<div class="ts-auth-fields" id="login-form" novalidate><div class="ts-field"><label class="ts-label" for="login-email">Email</label><input class="ts-input" id="login-email" name="loginEmail" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required></div><div class="ts-field"><div class="flex justify-between"><label class="ts-label" for="login-password">Password</label><a class="small" href="forgot-password.php">Forgot password?</a></div><input class="ts-input" id="login-password" name="loginPassword" type="password" autocomplete="current-password" maxlength="4096" placeholder="Enter your password" required></div><div class="ts-check-row"><input type="checkbox" id="remember"><label for="remember" class="small secondary">Keep me signed in on this device</label></div><button class="ts-btn ts-btn-primary w-full" id="login-submit" type="button">Sign In</button></div>
<div class="ts-auth-footer">New to TickSecure? <a href="register.php"><strong>Create account</strong></a></div>
<div class="ts-alert ts-alert-info mt-24"><?=ts_icon('shield')?><div><strong>Role-based access</strong><div class="small mt-8">After sign in, TickSecure routes Buyer, Event Organizer and Administrator accounts to the correct interface.</div></div></div>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('login-submit');
    const form = document.getElementById('login-form');
    if(!submitBtn || !form) return;

    if (new URLSearchParams(window.location.search).get('verified') === '1') {
        window.tsValidation?.showGlobalSuccess(
            form,
            'Email verified',
            'Your email has been verified. Sign in to continue.'
        );
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('verified');
        window.history.replaceState({}, '', cleanUrl);
    }

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const V = window.tsValidation;
        if (!V) return;
        V.clearFieldErrors(form);

        const emailInput = V.el(form, 'loginEmail');
        const passwordInput = V.el(form, 'loginPassword');
        const email = V.val(form, 'loginEmail');
        const password = passwordInput?.value || '';
        const valid = V.runAll([
            { check: () => V.validateRequired(email, 'Email'), el: emailInput },
            { check: () => V.validateEmail(email), el: emailInput },
            { check: () => V.validateRequired(password, 'Password'), el: passwordInput },
            { check: () => V.validateMaxLength(password, 4096, 'Password'), el: passwordInput }
        ]);
        if (!valid) return;
        
        submitBtn.textContent = "Signing In...";
        submitBtn.disabled = true;
        
        try {
            const cred = await window.tsAuth.login(email, password);
            const profile = await window.tsDb.getUserProfile(cred.user.uid);
            
            if(!profile) throw new Error("Profile not found in database. Please contact support.");

            // ============================================================
// EMAIL VERIFICATION
// Admin does NOT require email verification.
// Buyer and Organizer MUST verify their email.
// ============================================================

if (profile.role !== 'admin') {

    if (!cred.user.emailVerified) {

        window.location.href =
            `verify-email.php?email=${encodeURIComponent(
                cred.user.email || email
            )}`;

        return;
    }


    // Firebase says the email is verified.
    // Synchronise the status into Firestore.
    await window.tsAuth
        .syncEmailVerification()
        .catch(error => {

            console.warn(
                'Email verification status could not be synced:',
                error
            );

        });

}
            
            if (profile.status !== 'active') {
                await window.tsAuth.logout();
                throw new Error(`Your account is ${profile.status || 'not active'}. Please contact support or wait for approval.`);
            }
            
            if(profile.role === 'admin') window.location.href = '../admin/dashboard.php';
            else if(profile.role === 'organizer') window.location.href = '../organizer/dashboard.php';
            else window.location.href = '../public/events.php';
            
        } catch (err) {
            let errorMsg = err.message;
            if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errorMsg = "Invalid email or password.";
            else if(err.code === 'auth/too-many-requests') errorMsg = "Too many failed attempts. Try again later.";
            V.showGlobalError(form, 'Sign In Failed', errorMsg);
            
            submitBtn.textContent = "Sign In";
            submitBtn.disabled = false;
        }
    });
});
</script>

<?php
$content=ob_get_clean();
render_auth_page('Sign In',$content,'..');
?>
