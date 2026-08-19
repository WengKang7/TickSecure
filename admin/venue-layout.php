<?php

require_once __DIR__ . '/../shared/ui.php';

/*
|--------------------------------------------------------------------------
| UI Preview Step
|--------------------------------------------------------------------------
| step=3 : Review detected sections
| step=4 : Generate seats
| step=5 : Review and activate layout
|--------------------------------------------------------------------------
*/

$step = isset($_GET['step'])
    ? (int) $_GET['step']
    : 3;

if ($step < 3 || $step > 5) {
    $step = 3;
}

$activated = isset($_GET['activated'])
    && $_GET['activated'] === '1';


/*
|--------------------------------------------------------------------------
| Stepper UI State
|--------------------------------------------------------------------------
*/

$reviewClass = $step === 3
    ? 'active'
    : 'done';

$reviewNumber = $step > 3
    ? '✓'
    : '3';


$generateClass = '';

if ($step === 4) {
    $generateClass = 'active';
} elseif ($step > 4) {
    $generateClass = 'done';
}

$generateNumber = $step > 4
    ? '✓'
    : '4';


$activateClass = '';

if ($step === 5 && !$activated) {
    $activateClass = 'active';
} elseif ($activated) {
    $activateClass = 'done';
}

$activateNumber = $activated
    ? '✓'
    : '5';


ob_start();

?>


<?= ts_page_head(
    'Venue Blueprint Processing',
    'Upload, analyse, review and activate a reusable physical seating layout.',
    '
        <button
            class="ts-btn ts-btn-secondary"
            data-toast="Layout draft saved"
        >
            Save Draft
        </button>
    '
) ?>


<!-- =========================================================
     PROCESS STEPPER
     ========================================================= -->

<div class="ts-steps">

    <div class="ts-step done">
        <span class="ts-step-num">
            ✓
        </span>

        Upload
    </div>


    <span class="ts-step-line"></span>


    <div class="ts-step done">
        <span class="ts-step-num">
            ✓
        </span>

        Processing
    </div>


    <span class="ts-step-line"></span>


    <div class="ts-step <?= $reviewClass ?>">

        <span class="ts-step-num">
            <?= $reviewNumber ?>
        </span>

        Review Sections

    </div>


    <span class="ts-step-line"></span>


    <div class="ts-step <?= $generateClass ?>">

        <span class="ts-step-num">
            <?= $generateNumber ?>
        </span>

        Generate Seats

    </div>


    <span class="ts-step-line"></span>


    <div class="ts-step <?= $activateClass ?>">

        <span class="ts-step-num">
            <?= $activateNumber ?>
        </span>

        Activate

    </div>

</div>



<?php if ($step === 3): ?>

<!-- =====================================================
         STEP 3
         REVIEW DETECTED SECTIONS
         ===================================================== -->


<!-- Uploaded Blueprint -->

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

        <?= ts_status(
            'Uploaded',
            'success'
        ) ?>

    </div>


    <div class="ts-uploaded-file mt-20">

        <div class="ts-file-icon">
            <?= ts_icon('file') ?>
        </div>


        <div class="ts-file-info">

            <strong>
                merdeka-hall-layout.pdf
            </strong>

            <div class="small muted mt-4">
                PDF · 2.8 MB
            </div>

            <div class="ts-file-success mt-8">

                <span>
                    ✓
                </span>

                Successfully processed

            </div>

        </div>


        <label class="ts-btn ts-btn-secondary ts-file-replace">

            <?= ts_icon('upload') ?>

            Replace File

            <input type="file" style="display:none" data-file-name="blueprint-file">

        </label>

    </div>

</div>



<!-- Blueprint + Detected Sections -->

<div class="ts-blueprint-grid">


    <!-- LEFT SIDE -->

    <div class="ts-blueprint">

        <div class="ts-blueprint-plan">

            <div class="ts-stage-block">
                STAGE
            </div>


            <div class="ts-section-box s1 active" data-section-box="1">
                Detected 1
            </div>


            <div class="ts-section-box s2" data-section-box="2">
                Detected 2
            </div>


            <div class="ts-section-box s3" data-section-box="3">
                Detected 3
            </div>

        </div>

    </div>



    <!-- RIGHT SIDE -->

    <aside class="ts-card ts-card-pad">

        <div class="flex justify-between items-center">

            <div>

                <div class="ts-card-title">
                    Detected Sections
                </div>

                <div class="ts-card-sub">
                    3 sections identified
                </div>

            </div>

            <?= ts_status(
                'Review',
                'warning'
            ) ?>

        </div>



        <div class="ts-section-editor mt-16">


            <!-- Section 1 -->

            <div class="ts-section-editor-card active" data-section-card="1">

                <div class="flex justify-between">

                    <strong>
                        Detected Section 1
                    </strong>

                    <?= ts_status(
                        'Valid',
                        'success'
                    ) ?>

                </div>


                <div class="ts-form-grid mt-12">


                    <div class="ts-field">

                        <label class="ts-label">
                            Section Name
                        </label>

                        <input class="ts-input" value="Section A">

                    </div>


                    <div class="ts-field">

                        <label class="ts-label">
                            Seat Count
                        </label>

                        <input class="ts-input" value="20">

                    </div>

                </div>

            </div>



            <!-- Section 2 -->

            <div class="ts-section-editor-card" data-section-card="2">

                <div class="flex justify-between">

                    <strong>
                        Detected Section 2
                    </strong>

                    <?= ts_status(
                        'Valid',
                        'success'
                    ) ?>

                </div>

                <div class="small muted mt-8">
                    Section B · 40 seats
                </div>

            </div>



            <!-- Section 3 -->

            <div class="ts-section-editor-card" data-section-card="3">

                <div class="flex justify-between">

                    <strong>
                        Detected Section 3
                    </strong>

                    <?= ts_status(
                        'Valid',
                        'success'
                    ) ?>

                </div>

                <div class="small muted mt-8">
                    Section C · 60 seats
                </div>

            </div>

        </div>



        <button class="ts-btn ts-btn-secondary w-full mt-16">

            <?= ts_icon('plus') ?>

            Add Missing Section

        </button>


        <div class="ts-divider"></div>


        <div class="ts-alert ts-alert-info">

            <?= ts_icon('info') ?>

            <div class="small">

                Do not assign VIP1, VIP2 or CAT1 here.
                These are physical venue sections.
                Event-specific ticket categories are
                configured later by the Event Organizer.

            </div>

        </div>


        <a href="venue-layout.php?step=4" class="ts-btn ts-btn-primary w-full mt-16">
            Confirm Sections & Generate Seats
        </a>

    </aside>

</div>


<?php endif; ?>



<?php if ($step === 4): ?>

<!-- =====================================================
         STEP 4
         GENERATE SEATS
         ===================================================== -->


<!-- Generation Summary -->

<div class="ts-card ts-card-pad mb-24">

    <div class="flex justify-between items-center">

        <div>

            <div class="ts-card-title">
                Seat Generation
            </div>

            <div class="ts-card-sub">
                Physical seat records have been generated
                from the confirmed venue sections.
            </div>

        </div>

        <?= ts_status(
            'Generated',
            'success'
        ) ?>

    </div>



    <div class="ts-generation-summary mt-20">


        <div class="ts-generation-stat">

            <span class="ts-generation-number">
                120
            </span>

            <span class="small muted">
                Seats Generated
            </span>

        </div>


        <div class="ts-generation-divider"></div>


        <div class="ts-generation-stat">

            <span class="ts-generation-number">
                3
            </span>

            <span class="small muted">
                Sections Completed
            </span>

        </div>

    </div>



    <div class="ts-generation-progress mt-20">

        <div class="flex justify-between mb-8">

            <span class="small">
                Generation Progress
            </span>

            <strong class="small">
                100%
            </strong>

        </div>


        <div class="ts-progress-track">

            <div class="ts-progress-fill" style="width:100%;"></div>

        </div>

    </div>

</div>



<div class="ts-seat-generation-layout">


    <!-- =================================================
             LEFT
             GENERATED VENUE VISUAL
             ================================================= -->

    <div class="ts-generated-board">

        <div class="ts-generated-stage">
            STAGE
        </div>



        <!-- Section A -->

        <div class="ts-generated-section" style="
            left:7%;
            top:125px;
            width:35%;
            height:125px;
        ">

            <div class="ts-generated-section-content">

                <strong>
                    Section A
                </strong>

                <span>
                    20 seats
                </span>

                <span class="ts-generated-success">
                    ✓ Generated
                </span>

            </div>

        </div>



        <!-- Section B -->

        <div style="
    right:7%;
    top:125px;
    width:35%;
    height:125px;
">

            <div class="ts-generated-section-content">

                <strong>
                    Section B
                </strong>

                <span>
                    40 seats
                </span>

                <span class="ts-generated-success">
                    ✓ Generated
                </span>

            </div>

        </div>



        <!-- Section C -->

        <div style="
    left:20%;
    right:20%;
    bottom:45px;
    height:120px;
">

            <div class="ts-generated-section-content">

                <strong>
                    Section C
                </strong>

                <span>
                    60 seats
                </span>

                <span class="ts-generated-success">
                    ✓ Generated
                </span>

            </div>

        </div>

    </div>



    <!-- =================================================
             RIGHT
             GENERATION STATUS
             ================================================= -->

    <div class="ts-card ts-card-pad">

        <div class="flex justify-between items-center">

            <div>

                <div class="ts-card-title">
                    Seat Generation Status
                </div>

                <div class="ts-card-sub">
                    All confirmed venue sections
                    have been processed successfully.
                </div>

            </div>

            <?= ts_status(
                'Complete',
                'success'
            ) ?>

        </div>



        <div class="ts-generation-section-list mt-20">


            <!-- Section A -->

            <div class="ts-generation-row">

                <div>

                    <strong>
                        Section A
                    </strong>

                    <div class="small muted">
                        Seat A01 – A20
                    </div>

                </div>


                <div class="text-right">

                    <strong>
                        20 / 20
                    </strong>

                    <div class="small success-text">
                        Generated
                    </div>

                </div>

            </div>



            <!-- Section B -->

            <div class="ts-generation-row">

                <div>

                    <strong>
                        Section B
                    </strong>

                    <div class="small muted">
                        Seat B01 – B40
                    </div>

                </div>


                <div class="text-right">

                    <strong>
                        40 / 40
                    </strong>

                    <div class="small success-text">
                        Generated
                    </div>

                </div>

            </div>



            <!-- Section C -->

            <div class="ts-generation-row">

                <div>

                    <strong>
                        Section C
                    </strong>

                    <div class="small muted">
                        Seat C01 – C60
                    </div>

                </div>


                <div class="text-right">

                    <strong>
                        60 / 60
                    </strong>

                    <div class="small success-text">
                        Generated
                    </div>

                </div>

            </div>

        </div>



        <div class="ts-generation-total mt-20">

            <span>
                Total Generated Seats
            </span>

            <strong>
                120
            </strong>

        </div>



        <div class="ts-note mt-16">

            <?= ts_icon('info') ?>

            <div class="small">

                Seat identifiers and assignment order have
                been generated automatically for every
                confirmed section.

            </div>

        </div>



        <div class="flex gap-12 mt-20">

            <a href="venue-layout.php?step=3" class="ts-btn ts-btn-secondary">
                Back
            </a>


            <a href="venue-layout.php?step=5" class="ts-btn ts-btn-primary" style="flex:1;">
                Continue to Activation
            </a>

        </div>

    </div>

</div>



<!-- Generated Seat Identifier Preview -->

<div class="ts-card ts-card-pad mt-24">

    <div class="ts-card-title">
        Generated Seat Structure Preview
    </div>

    <div class="ts-card-sub">
        Assignment order is used later for automatic
        Buyer seat assignment.
    </div>


    <div class="ts-grid-3 mt-20">


        <!-- A -->

        <div>

            <strong>
                Section A · 20 seats
            </strong>


            <div class="ts-seat-pills mt-12">

                <?php for ($i = 1; $i <= 20; $i++): ?>

                <span class="ts-seat-pill">

                    A<?= str_pad(
                        (string) $i,
                        2,
                        '0',
                        STR_PAD_LEFT
                    ) ?>

                </span>

                <?php endfor; ?>

            </div>

        </div>



        <!-- B -->

        <div>

            <strong>
                Section B · 40 seats
            </strong>


            <div class="ts-seat-pills mt-12">

                <?php for ($i = 1; $i <= 12; $i++): ?>

                <span class="ts-seat-pill">

                    B<?= str_pad(
                        (string) $i,
                        2,
                        '0',
                        STR_PAD_LEFT
                    ) ?>

                </span>

                <?php endfor; ?>


                <span class="small muted">
                    +28 more
                </span>

            </div>

        </div>



        <!-- C -->

        <div>

            <strong>
                Section C · 60 seats
            </strong>


            <div class="ts-seat-pills mt-12">

                <?php for ($i = 1; $i <= 12; $i++): ?>

                <span class="ts-seat-pill">

                    C<?= str_pad(
                        (string) $i,
                        2,
                        '0',
                        STR_PAD_LEFT
                    ) ?>

                </span>

                <?php endfor; ?>


                <span class="small muted">
                    +48 more
                </span>

            </div>

        </div>

    </div>

</div>


<?php endif; ?>



<?php if ($step === 5 && !$activated): ?>

<!-- =====================================================
         STEP 5
         ACTIVATION REVIEW
         ===================================================== -->


<div class="ts-card ts-card-pad mb-24">

    <div class="flex justify-between items-center">

        <div>

            <div class="ts-card-title">
                Ready for Activation
            </div>

            <div class="ts-card-sub">
                Review the final venue layout before
                making it available to Event Organizers.
            </div>

        </div>

        <?= ts_status(
            'Ready',
            'success'
        ) ?>

    </div>



    <div class="ts-activation-summary mt-20">


        <div class="ts-activation-item">

            <span class="small muted">
                Venue
            </span>

            <strong>
                Merdeka Hall
            </strong>

        </div>


        <div class="ts-activation-item">

            <span class="small muted">
                Sections
            </span>

            <strong>
                3
            </strong>

        </div>


        <div class="ts-activation-item">

            <span class="small muted">
                Generated Seats
            </span>

            <strong>
                120
            </strong>

        </div>


        <div class="ts-activation-item">

            <span class="small muted">
                Layout Status
            </span>

            <strong>
                Ready
            </strong>

        </div>

    </div>

</div>



<div class="ts-seat-generation-layout">


    <!-- LEFT FINAL LAYOUT -->

    <div class="ts-generated-board">

        <div class="ts-generated-stage">
            STAGE
        </div>



        <div class="ts-generated-section" style="
                    left:8%;
                    top:150px;
                    width:34%;
                    height:145px;
                ">

            <div class="ts-generated-section-content">

                <strong>
                    Section A
                </strong>

                <span>
                    20 seats
                </span>

            </div>

        </div>



        <div class="ts-generated-section" style="
                    right:8%;
                    top:150px;
                    width:34%;
                    height:145px;
                ">

            <div class="ts-generated-section-content">

                <strong>
                    Section B
                </strong>

                <span>
                    40 seats
                </span>

            </div>

        </div>



        <div class="ts-generated-section" style="
                    left:18%;
                    right:18%;
                    bottom:52px;
                    height:140px;
                ">

            <div class="ts-generated-section-content">

                <strong>
                    Section C
                </strong>

                <span>
                    60 seats
                </span>

            </div>

        </div>

    </div>



    <!-- RIGHT ACTIVATION CHECKLIST -->

    <div class="ts-card ts-card-pad">

        <div class="ts-card-title">
            Activation Checklist
        </div>

        <div class="ts-card-sub">
            All requirements have been completed.
        </div>



        <div class="ts-activation-checks mt-20">


            <div class="ts-activation-check">

                <span class="ts-check-success">
                    ✓
                </span>

                <div>

                    <strong>
                        Blueprint Processed
                    </strong>

                    <div class="small muted">
                        Venue blueprint successfully analysed.
                    </div>

                </div>

            </div>



            <div class="ts-activation-check">

                <span class="ts-check-success">
                    ✓
                </span>

                <div>

                    <strong>
                        Sections Reviewed
                    </strong>

                    <div class="small muted">
                        3 physical venue sections confirmed.
                    </div>

                </div>

            </div>



            <div class="ts-activation-check">

                <span class="ts-check-success">
                    ✓
                </span>

                <div>

                    <strong>
                        Seat Counts Confirmed
                    </strong>

                    <div class="small muted">
                        Seat capacity verified for every section.
                    </div>

                </div>

            </div>



            <div class="ts-activation-check">

                <span class="ts-check-success">
                    ✓
                </span>

                <div>

                    <strong>
                        Seats Generated
                    </strong>

                    <div class="small muted">
                        120 physical seat records generated.
                    </div>

                </div>

            </div>

        </div>



        <div class="ts-alert ts-alert-info mt-20">

            <?= ts_icon('info') ?>

            <div>

                <strong>
                    What happens after activation?
                </strong>

                <div class="small mt-8">

                    Event Organizers will be able to select
                    this venue when creating an event and
                    view its approved physical seating layout.

                </div>

                <div class="small mt-6">

                    Buyers will later view the same venue
                    layout with the event-specific ticket
                    categories configured by the Organizer.

                </div>

            </div>

        </div>



        <div class="flex gap-12 mt-20">

            <a href="venue-layout.php?step=4" class="ts-btn ts-btn-secondary">
                Back
            </a>


            <a href="venue-layout.php?step=5&activated=1" class="ts-btn ts-btn-primary" style="flex:1;">
                Activate Venue Layout
            </a>

        </div>

    </div>

</div>


<?php endif; ?>



<?php if ($step === 5 && $activated): ?>

<!-- =====================================================
         ACTIVATION SUCCESS
         ===================================================== -->


<div class="ts-activation-success">

    <div class="ts-success-icon-large">
        ✓
    </div>


    <h2>
        Venue Layout Activated
    </h2>


    <p class="secondary">

        Merdeka Hall is now available for Event Organizers
        to select when creating new events.

    </p>



    <div class="ts-card ts-card-pad mt-24">

        <div class="ts-activation-result-grid">


            <div>

                <span class="small muted">
                    Venue
                </span>

                <strong>
                    Merdeka Hall
                </strong>

            </div>


            <div>

                <span class="small muted">
                    Sections
                </span>

                <strong>
                    3
                </strong>

            </div>


            <div>

                <span class="small muted">
                    Seats
                </span>

                <strong>
                    120
                </strong>

            </div>


            <div>

                <span class="small muted">
                    Status
                </span>

                <?= ts_status(
                    'Active',
                    'success'
                ) ?>

            </div>

        </div>

    </div>



    <div class="ts-alert ts-alert-success mt-24">

        <?= ts_icon('check') ?>

        <div>

            The approved physical venue layout can now be
            reused by Event Organizers when configuring
            future events.

        </div>

    </div>



    <div class="flex gap-12 justify-center mt-24">

        <a href="venues.php" class="ts-btn ts-btn-secondary">
            Back to Venues
        </a>


        <a href="venue-detail.php" class="ts-btn ts-btn-primary">
            View Venue
        </a>

    </div>

</div>


<?php endif; ?>



<?php

$content = ob_get_clean();

render_dashboard_page(
    'admin',
    'Blueprint Processing',
    'venues',
    $content,
    '..',
    ''
);

?>