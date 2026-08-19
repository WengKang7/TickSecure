<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Venue Blueprint Processing', 'Upload, analyse, review and activate a reusable physical seating layout.', '<button class="ts-btn ts-btn-secondary" data-toast="Layout draft saved">Save Draft</button>')?>
<div class="ts-steps">
    <div class="ts-step done"><span class="ts-step-num">✓</span>Upload</div><span class="ts-step-line"></span>
    <div class="ts-step done"><span class="ts-step-num">✓</span>Processing</div><span class="ts-step-line"></span>
    <div class="ts-step active"><span class="ts-step-num">3</span>Review Sections</div><span
        class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">4</span>Generate Seats</div><span class="ts-step-line"></span>
    <div class="ts-step"><span class="ts-step-num">5</span>Activate</div>
</div>
<div class="ts-card ts-card-pad">

    <div class="flex justify-between items-center">
        <div>
            <div class="ts-card-title">
                Uploaded Blueprint
            </div>

            <div class="ts-card-sub">
                Original venue layout used for section detection.
            </div>
        </div>

        <?=ts_status('Uploaded', 'success')?>
    </div>


    <div class="ts-uploaded-file mt-20">

        <div class="ts-file-icon">
            <?=ts_icon('file')?>
        </div>

        <div class="ts-file-info">
            <strong>
                merdeka-hall-layout.pdf
            </strong>

            <div class="small muted mt-4">
                PDF · 2.8 MB
            </div>

            <div class="ts-file-success mt-8">
                <span>✓</span>
                Successfully processed
            </div>
        </div>


        <label class="ts-btn ts-btn-secondary ts-file-replace">
            <?=ts_icon('upload')?>
            Replace File

            <input type="file" style="display:none" data-file-name="blueprint-file">
        </label>

    </div>

</div>
<div class="ts-blueprint-grid">
    <div class="ts-blueprint">
        <div class="ts-blueprint-plan">
            <div class="ts-stage-block">STAGE</div>
            <div class="ts-section-box s1 active" data-section-box="1">Detected 1</div>
            <div class="ts-section-box s2" data-section-box="2">Detected 2</div>
            <div class="ts-section-box s3" data-section-box="3">Detected 3</div>
        </div>
    </div>
    <aside class="ts-card ts-card-pad">
        <div class="flex justify-between items-center">
            <div>
                <div class="ts-card-title">Detected Sections</div>
                <div class="ts-card-sub">3 sections identified</div>
            </div>
            <?=ts_status('Review', 'warning')?>
        </div>
        <div class="ts-section-editor mt-16">
            <div class="ts-section-editor-card active" data-section-card="1">
                <div class="flex justify-between"><strong>Detected Section
                        1</strong><?=ts_status('Valid', 'success')?>
                </div>
                <div class="ts-form-grid mt-12">
                    <div class="ts-field"><label class="ts-label">Section Name</label><input class="ts-input"
                            value="Section A"></div>
                    <div class="ts-field"><label class="ts-label">Seat Count</label><input class="ts-input" value="20">
                    </div>
                </div>
            </div>
            <div class="ts-section-editor-card" data-section-card="2">
                <div class="flex justify-between"><strong>Detected Section
                        2</strong><?=ts_status('Valid', 'success')?>
                </div>
                <div class="small muted mt-8">Section B · 40 seats</div>
            </div>
            <div class="ts-section-editor-card" data-section-card="3">
                <div class="flex justify-between"><strong>Detected Section
                        3</strong><?=ts_status('Valid', 'success')?>
                </div>
                <div class="small muted mt-8">Section C · 60 seats</div>
            </div>
        </div><button
            class="ts-btn ts-btn-secondary w-full mt-16"><?=ts_icon('plus')?>
            Add Missing Section</button>
        <div class="ts-divider"></div>
        <div class="ts-alert ts-alert-info">
            <?=ts_icon('info')?>
            <div class="small">Do not assign VIP1/CAT1 here. These are physical venue sections. Event-specific ticket
                categories are configured later by the Organizer.</div>
        </div><button class="ts-btn ts-btn-primary w-full mt-20" data-toast="Seat generation preview prepared">Confirm
            Sections & Generate Seats</button>
    </aside>
</div>
<div class="ts-card ts-card-pad mt-24">
    <div class="flex justify-between items-center">
        <div>
            <div class="ts-card-title">Generated Seat Structure Preview</div>
            <div class="ts-card-sub">Assignment order is used later for automatic buyer seat assignment.</div>
        </div><button class="ts-btn ts-btn-success" data-modal-open="confirm-modal">Activate Seating Layout</button>
    </div>
    <div class="ts-grid-3 mt-20">
        <div><strong>Section A · 20 seats</strong>
            <div class="ts-seat-pills mt-12">
                <?php for ($i = 1;$i <= 20;$i++): ?><span
                    class="ts-seat-pill">A<?=str_pad((string)$i, 2, '0', STR_PAD_LEFT)?></span><?php endfor;?>
            </div>
        </div>
        <div><strong>Section B · 40 seats</strong>
            <div class="ts-seat-pills mt-12">
                <?php for ($i = 1;$i <= 12;$i++): ?><span
                    class="ts-seat-pill">B<?=str_pad((string)$i, 2, '0', STR_PAD_LEFT)?></span><?php endfor;?><span
                    class="small muted">+28 more</span></div>
        </div>
        <div><strong>Section C · 60 seats</strong>
            <div class="ts-seat-pills mt-12">
                <?php for ($i = 1;$i <= 12;$i++): ?><span
                    class="ts-seat-pill">C<?=str_pad((string)$i, 2, '0', STR_PAD_LEFT)?></span><?php endfor;?><span
                    class="small muted">+48 more</span></div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
render_dashboard_page('admin','Blueprint Processing','venues',$content,'..','');
?>