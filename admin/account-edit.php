<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<?=ts_page_head('Account Details', 'Create a buyer or pending organizer account, or update an existing profile.', '<a class="ts-btn ts-btn-secondary" href="users.php">Back to users</a>')?>
<div class="ts-card ts-card-pad" style="max-width:800px">
    <form id="account-form" class="ts-auth-fields">
        <div class="ts-field"><label class="ts-label" for="account-name">Full name</label><input class="ts-input" id="account-name" name="fullName" required minlength="3" maxlength="100"></div>
        <div class="ts-field"><label class="ts-label" for="account-email">Email</label><input class="ts-input" id="account-email" name="email" type="email" required maxlength="254"></div>
        <div class="ts-field"><label class="ts-label" for="account-role">Role</label><select class="ts-select" id="account-role" name="role"><option value="buyer">Buyer</option><option value="organizer">Event Organizer</option></select></div>
        <div class="ts-field" id="password-field"><label class="ts-label" for="account-password">Initial password</label><input class="ts-input" id="account-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="4096" required><p class="small secondary">Include uppercase, lowercase, a number and a special character. The new user must verify their email before using protected features.</p></div>
        <fieldset id="organization-fields" hidden disabled style="border:0;padding:0">
            <legend class="ts-card-title">Organization</legend>
            <div class="ts-field"><label class="ts-label" for="org-name">Organization name</label><input class="ts-input" id="org-name" name="organizationName" required maxlength="120"></div>
            <div class="ts-field"><label class="ts-label" for="org-phone">Phone</label><input class="ts-input" id="org-phone" name="organizationPhone" required maxlength="50"></div>
            <div class="ts-field"><label class="ts-label" for="org-address">Address</label><textarea class="ts-textarea" id="org-address" name="organizationAddress" required maxlength="1000"></textarea></div>
            <div class="ts-field"><label class="ts-label" for="org-description">Description</label><textarea class="ts-textarea" id="org-description" name="organizationDescription" required maxlength="5000"></textarea></div>
        </fieldset>
        <p id="account-message" role="status" aria-live="polite"></p>
        <div class="flex gap-12"><button class="ts-btn ts-btn-primary" id="account-save" type="submit" disabled>Save account</button><button class="ts-btn ts-btn-danger" type="button" id="account-archive" hidden>Archive account</button></div>
        <p class="small secondary" id="archive-help" hidden>Archiving removes access and retains linked bookings, tickets and support history. Administrator accounts cannot be archived here.</p>
    </form>
</div>
<script type="module" src="<?=ts_asset_url('assets/js/account-editor.js', '..')?>"></script>
<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Account Details', 'users', $content, '..', '');
?>
