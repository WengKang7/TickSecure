<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="../index.php" class="small secondary">← Back to TickSecure</a><h1 class="ts-auth-title mt-24">Welcome back</h1><p class="ts-auth-sub">Sign in to continue to your TickSecure account.</p>
<div class="ts-auth-fields"><div class="ts-field"><label class="ts-label">Email</label><input class="ts-input" type="email" placeholder="you@example.com"></div><div class="ts-field"><div class="flex justify-between"><label class="ts-label">Password</label><a class="small" href="forgot-password.php">Forgot password?</a></div><input class="ts-input" type="password" placeholder="Enter your password"></div><div class="ts-check-row"><input type="checkbox" id="remember"><label for="remember" class="small secondary">Keep me signed in on this device</label></div><button class="ts-btn ts-btn-primary w-full" data-modal-open="confirm-modal">Sign In</button></div>
<div class="ts-auth-footer">New to TickSecure? <a href="register.php"><strong>Create account</strong></a></div>
<div class="ts-alert ts-alert-info mt-24"><?=ts_icon('shield')?><div><strong>Role-based access</strong><div class="small mt-8">After sign in, TickSecure routes Buyer, Event Organizer and Administrator accounts to the correct interface.</div></div></div>

<?php
$content=ob_get_clean();
render_auth_page('Sign In',$content,'..');
?>
