<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="../index.php" class="small secondary">← Back to TickSecure</a><h1 class="ts-auth-title mt-24">Welcome back</h1><p class="ts-auth-sub">Sign in to continue to your TickSecure account.</p>
<div class="ts-auth-fields"><div class="ts-field"><label class="ts-label">Email</label><input class="ts-input" type="email" placeholder="you@example.com"></div><div class="ts-field"><div class="flex justify-between"><label class="ts-label">Password</label><a class="small" href="forgot-password.php">Forgot password?</a></div><input class="ts-input" type="password" placeholder="Enter your password"></div><div class="ts-check-row"><input type="checkbox" id="remember"><label for="remember" class="small secondary">Keep me signed in on this device</label></div><button class="ts-btn ts-btn-primary w-full" id="login-submit">Sign In</button></div>
<div class="ts-auth-footer">New to TickSecure? <a href="register.php"><strong>Create account</strong></a></div>
<div class="ts-alert ts-alert-info mt-24"><?=ts_icon('shield')?><div><strong>Role-based access</strong><div class="small mt-8">After sign in, TickSecure routes Buyer, Event Organizer and Administrator accounts to the correct interface.</div></div></div>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('login-submit');
    if(!submitBtn) return;

    const showError = (input, msg) => {
        input.style.borderColor = 'var(--error)';
        input.style.boxShadow = '0 0 0 3px var(--error-bg)';
        let errNode = input.parentElement.querySelector('.ts-error-msg');
        if (!errNode) {
            errNode = document.createElement('div');
            errNode.className = 'ts-error-msg small mt-8';
            errNode.style.color = 'var(--error)';
            errNode.style.fontWeight = '500';
            input.parentElement.appendChild(errNode);
        }
        errNode.textContent = msg;
        errNode.style.display = 'block';
    };

    const clearErrors = () => {
        document.querySelectorAll('.ts-input').forEach(el => {
            el.style.borderColor = '';
            el.style.boxShadow = '';
        });
        document.querySelectorAll('.ts-error-msg').forEach(el => el.style.display = 'none');
        const globalErr = document.getElementById('global-err');
        if(globalErr) globalErr.style.display = 'none';
    };

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearErrors();
        
        let hasError = false;
        const emailInput = document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('input[type="password"]');
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)) {
            showError(emailInput, "Please enter a valid email address.");
            hasError = true;
        }
        
        if(!password) {
            showError(passwordInput, "Password is required.");
            hasError = true;
        }
        
        if(hasError) return;
        
        submitBtn.textContent = "Signing In...";
        submitBtn.disabled = true;
        
        try {
            const cred = await window.tsAuth.login(email, password);
            const profile = await window.tsDb.getUserProfile(cred.user.uid);
            
            if(!profile) throw new Error("Profile not found in database. Please contact support.");
            
            if (profile.role === 'organizer' && (profile.status === 'pending' || profile.status === 'suspended' || profile.status === 'rejected')) {
                await window.tsAuth.logout();
                throw new Error(`Your organizer account is ${profile.status}. Please wait for administrator approval before logging in.`);
            }
            
            if(profile.role === 'admin') window.location.href = '../admin/dashboard.php';
            else if(profile.role === 'organizer') window.location.href = '../organizer/dashboard.php';
            else window.location.href = '../public/events.php';
            
        } catch (err) {
            let topErr = document.getElementById('global-err');
            if(!topErr) {
                topErr = document.createElement('div');
                topErr.id = 'global-err';
                topErr.className = 'ts-alert mb-24';
                topErr.style.backgroundColor = 'var(--error-bg)';
                topErr.style.color = 'var(--error)';
                topErr.style.border = '1px solid #F0B4AF';
                document.querySelector('.ts-auth-fields').prepend(topErr);
            }
            
            let errorMsg = err.message;
            if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errorMsg = "Invalid email or password.";
            else if(err.code === 'auth/too-many-requests') errorMsg = "Too many failed attempts. Try again later.";
            
            topErr.innerHTML = `<strong>Sign In Failed</strong><div class="small mt-8">${errorMsg}</div>`;
            topErr.style.display = 'block';
            
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
