<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<h1 class="ts-auth-title">Create a new password</h1><p class="ts-auth-sub">Use a strong password you have not used previously.</p><div class="ts-auth-fields"><div class="ts-field"><label class="ts-label">New Password</label><input class="ts-input" type="password" placeholder="New password"><div class="ts-help">Use at least 8 characters with upper/lowercase, number and symbol.</div></div><div class="ts-field"><label class="ts-label">Confirm Password</label><input class="ts-input" type="password" placeholder="Repeat new password"></div><button class="ts-btn ts-btn-primary w-full" data-modal-open="confirm-modal">Update Password</button></div>

<?php
$content=ob_get_clean();
render_auth_page('Reset Password',$content,'..');
?>
