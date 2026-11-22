<?php
function ts_profile_photo(): string
{
    return <<<'HTML'
<section class="ts-profile-photo" aria-label="Profile picture">
    <div id="profile-photo-avatar" class="ts-avatar ts-profile-photo-avatar">U</div>
    <div>
        <label class="ts-label" for="profile-photo-file">Profile picture</label>
        <input class="ts-input" type="file" id="profile-photo-file" accept="image/jpeg,image/png">
        <p class="small muted">JPG or PNG, up to 5 MB and 4096 pixels per side. A square photo works best.</p>
        <button class="ts-btn ts-btn-secondary ts-btn-sm" type="button" id="profile-photo-upload" disabled>Upload photo</button>
        <p class="ts-field-error" id="profile-photo-error" role="alert" hidden></p>
    </div>
</section>
HTML;
}

function ts_profile_password_form(): string
{
    return <<<'HTML'
<form id="profile-password-form" class="ts-auth-fields ts-profile-password mt-20">
    <p class="secondary">Confirm your current password to choose a new one.</p>
    <div class="ts-field">
        <label class="ts-label" for="profile-current-password">Current password</label>
        <input class="ts-input" type="password" id="profile-current-password" name="currentPassword" autocomplete="current-password" required>
        <p class="ts-field-error" id="profile-current-error" hidden></p>
    </div>
    <div class="ts-field">
        <label class="ts-label" for="profile-new-password">New password</label>
        <input class="ts-input" type="password" id="profile-new-password" name="newPassword" autocomplete="new-password" maxlength="4096" required>
        <p class="small muted">Use at least 8 characters, including uppercase, lowercase, a number and a special character.</p>
        <p class="ts-field-error" id="profile-new-error" hidden></p>
    </div>
    <div class="ts-field">
        <label class="ts-label" for="profile-confirm-password">Confirm new password</label>
        <input class="ts-input" type="password" id="profile-confirm-password" name="confirmPassword" autocomplete="new-password" maxlength="4096" required>
        <p class="ts-field-error" id="profile-confirm-error" hidden></p>
    </div>
    <button class="ts-btn ts-btn-primary" id="profile-password-save" type="submit" disabled>Change password</button>
    <p id="profile-security-status" role="status" hidden></p>
</form>
HTML;
}

function ts_profile_assets(): string
{
    return '<link rel="stylesheet" href="'.ts_asset_url('assets/css/profile.css', '..').'">'
        .'<script src="'.ts_asset_url('assets/js/profile-security.js', '..').'"></script>';
}
