<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:900px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Support request</div>
                <h1 class="ts-section-title">Submit a Complaint</h1>
                <p class="ts-section-copy">Provide clear details and supporting evidence so the administrator can
                    investigate efficiently.</p>
            </div>
        </div>
        <div class="ts-card ts-card-pad">
            <div class="ts-form-grid">
                <div class="ts-field"><label class="ts-label">Complaint Category</label><select class="ts-select">
                        <option>Payment issue</option>
                        <option>Ticket ownership dispute</option>
                        <option>Resale dispute</option>
                        <option>Refund request</option>
                        <option>Suspected fraud</option>
                        <option>Account issue</option>
                    </select></div>
                <div class="ts-field"><label class="ts-label">Related Booking</label><select class="ts-select">
                        <option>TS20260001 · Aurora After Dark</option>
                        <option>None</option>
                    </select></div>
                <div class="ts-field span-2"><label class="ts-label">Description</label><textarea class="ts-textarea"
                        placeholder="Describe what happened, when it happened and what outcome you are requesting."></textarea>
                </div>
                <div class="ts-field span-2"><label class="ts-label">Supporting Evidence</label><label
                        class="ts-dropzone"><input type="file" style="display:none" data-file-name="evidence-name"><span
                            class="ts-drop-icon"><?=ts_icon('upload')?></span><strong>Choose
                            a file or drag it here</strong>
                        <div id="evidence-name" class="small muted mt-8">PNG, JPG or PDF</div>
                    </label></div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="complaints.php">Cancel</a><button class="ts-btn ts-btn-primary"
                    data-modal-open="confirm-modal">Submit Complaint</button></div>
        </div>
    </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('New Complaint', 'tickets', $content, '..', true);
?>