<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<a href="login.php" class="small secondary">← Back to Sign In</a><h1 class="ts-auth-title mt-24">Reset your password</h1><p class="ts-auth-sub">Enter your registered email. If the account can be verified, reset instructions will be sent.</p><div class="ts-auth-fields"><div class="ts-field"><label class="ts-label">Email</label><input class="ts-input" type="email" placeholder="you@example.com"></div><button class="ts-btn ts-btn-primary w-full" data-toast="Password reset instructions requested">Send Reset Instructions</button></div>

<?php
$content=ob_get_clean();
render_auth_page('Forgot Password',$content,'..');
?>
