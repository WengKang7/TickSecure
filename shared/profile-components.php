<?php
function ts_profile_page_head(string $title, string $copy, string $role): string
{
    return '<header class="ts-profile-head"><div><div class="ts-profile-eyebrow">Account settings</div>'
        .'<h1>'.htmlspecialchars(html_entity_decode($title, ENT_QUOTES, 'UTF-8')).'</h1>'
        .'<p>'.htmlspecialchars($copy).'</p></div><span class="ts-profile-role">'.ts_icon('user').htmlspecialchars($role).'</span></header>';
}

function ts_profile_card_head(string $title, string $copy, string $icon): string
{
    return '<div class="ts-profile-card-head"><span class="ts-profile-card-icon" aria-hidden="true">'.ts_icon($icon).'</span>'
        .'<div><h2>'.htmlspecialchars(html_entity_decode($title, ENT_QUOTES, 'UTF-8')).'</h2><p>'.htmlspecialchars($copy).'</p></div></div>';
}

function ts_profile_photo(): string
{
    return <<<'HTML'
<section class="ts-profile-photo" aria-label="Profile picture">
    <div id="profile-photo-avatar" class="ts-avatar ts-profile-photo-avatar">U</div>
    <div class="ts-profile-photo-content">
        <label class="ts-label" for="profile-photo-file">Profile picture</label>
        <div class="ts-profile-photo-controls"><input class="ts-input" type="file" id="profile-photo-file" accept="image/jpeg,image/png">
        <button class="ts-btn ts-btn-secondary ts-btn-sm" type="button" id="profile-photo-upload" disabled>Upload photo</button></div>
        <p class="small muted">JPG or PNG, up to 5 MB. Maximum 4096 pixels per side.</p>
        <p class="ts-field-error" id="profile-photo-error" role="alert" hidden></p>
    </div>
</section>
HTML;
}

function ts_profile_password_form(): string
{
    return <<<'HTML'
<form id="profile-password-form" class="ts-auth-fields ts-profile-password">
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
    <div class="ts-profile-password-actions"><button class="ts-btn ts-btn-primary" id="profile-password-save" type="submit" disabled>Change password</button></div>
    <p id="profile-security-status" role="status" hidden></p>
</form>
HTML;
}

function ts_profile_assets(): string
{
    return '<link rel="stylesheet" href="'.ts_asset_url('assets/css/profile.css', '..').'">'
        .'<script src="'.ts_asset_url('assets/js/profile-security.js', '..').'"></script>';
}
