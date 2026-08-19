<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<div class="text-center"><div class="ts-success-icon" style="background:var(--brand-100);color:var(--brand-900)"><?=ts_icon('mail','ts-icon-xl')?></div><h1 class="ts-auth-title">Verify your email</h1><p class="ts-auth-sub">We sent a verification link to <strong>g***@example.com</strong>. Open the email to activate your account.</p><button class="ts-btn ts-btn-secondary w-full" data-toast="Verification email resent">Resend Verification Email</button><a class="ts-btn ts-btn-tertiary w-full mt-8" href="login.php">Return to Sign In</a></div>

<?php
$content=ob_get_clean();
render_auth_page('Verify Email',$content,'..');
?>
