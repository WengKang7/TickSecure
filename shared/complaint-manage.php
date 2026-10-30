<?php
// Included by the role-specific pages below; the Auth guard still owns routing.
?>
<div class="ts-card ts-card-pad" style="max-width:900px;margin:24px auto">
    <h1 class="ts-card-title">Complaint details</h1>
    <p class="secondary" id="complaint-meta">Loading complaint…</p>
    <form id="manage-complaint-form" class="ts-auth-fields">
        <div class="ts-field"><label class="ts-label" for="manage-category">Category</label><input class="ts-input" id="manage-category" name="category" required maxlength="120" disabled></div>
        <div class="ts-field"><label class="ts-label" for="manage-description">Description</label><textarea class="ts-textarea" id="manage-description" name="description" required minlength="10" maxlength="5000" rows="6" disabled></textarea></div>
        <div id="complaint-evidence" class="small"></div>
        <div id="complaint-progress" class="ts-timeline mt-20"></div>
        <p id="manage-message" role="status" aria-live="polite"></p>
        <div class="flex gap-12 wrap"><a class="ts-btn ts-btn-secondary" href="complaints.php">Back to complaints</a><button class="ts-btn ts-btn-primary" id="manage-save" type="submit" hidden>Save changes</button><button class="ts-btn ts-btn-danger" id="manage-delete" type="button" hidden>Delete complaint</button></div>
        <p class="small secondary">Open complaints can be edited or deleted before an administrator starts investigating. Evidence and investigation history remain protected.</p>
    </form>
</div>
<script type="module" src="<?=ts_asset_url('assets/js/complaint-manager.js', '..')?>"></script>
