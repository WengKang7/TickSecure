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

if ($step < 1 || $step > 5) {
    $step = 1;
}

$activated = isset($_GET['activated'])
    && $_GET['activated'] === '1';


/*
|--------------------------------------------------------------------------
| Stepper UI State
|--------------------------------------------------------------------------
*/

$uploadClass = $step === 1 ? 'active' : ($step > 1 ? 'done' : '');
$uploadNumber = $step > 1 ? '✓' : '1';

$processClass = $step === 2 ? 'active' : ($step > 2 ? 'done' : '');
$processNumber = $step > 2 ? '✓' : '2';

$reviewClass = $step === 3 ? 'active' : ($step > 3 ? 'done' : '');
$reviewNumber = $step > 3 ? '✓' : '3';

$generateClass = $step === 4 ? 'active' : ($step > 4 ? 'done' : '');
$generateNumber = $step > 4 ? '✓' : '4';

$activateClass = $step === 5 && !$activated ? 'active' : ($activated ? 'done' : '');
$activateNumber = $activated ? '✓' : '5';


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

    <div class="ts-step <?= $uploadClass ?>">
        <span class="ts-step-num">
            <?= $uploadNumber ?>
        </span>

        Upload
    </div>


    <span class="ts-step-line"></span>


    <div class="ts-step <?= $processClass ?>">
        <span class="ts-step-num">
            <?= $processNumber ?>
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



<?php if ($step === 1): ?>
<div class="ts-card ts-card-pad" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 60px 20px;">
    <?= ts_icon('upload', 48) ?>
    <h2 style="margin-top: 16px;">Upload Venue Blueprint</h2>
    <p class="muted mt-8" style="margin-bottom: 24px;">Upload a PDF of the physical venue layout. Our system will process it and detect seating sections.</p>
    
    <label class="ts-btn ts-btn-primary">
        Select File to Upload
        <input type="file" style="display:none" id="real-blueprint-file" accept=".pdf,application/pdf">
    </label>
    <div id="upload-error" class="ts-alert ts-alert-error mt-16" style="display:none; text-align: left;"></div>
    <div id="upload-status" class="mt-16" style="display:none;">Uploading blueprint to secure storage...</div>
</div>
<?php endif; ?>

<?php if ($step === 2): ?>
<div class="ts-card ts-card-pad" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 80px 20px;">
    <div style="display: inline-block; animation: spin 2s linear infinite;">
        <?= ts_icon('loader', 48) ?>
    </div>
    <h2 style="margin-top: 24px;">AI Blueprint Processing</h2>
    <p class="muted mt-8">Analyzing PDF structure and detecting physical seating sections...</p>
    <div style="max-width: 300px; height: 6px; background: var(--bg-alt); border-radius: 4px; margin: 32px auto 0; overflow: hidden;">
        <div style="height: 100%; width: 50%; background: var(--primary); border-radius: 4px; animation: progress 2s ease-in-out infinite alternate;"></div>
    </div>
    <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes progress { 0% { width: 0%; transform: translateX(0); } 100% { width: 50%; transform: translateX(100%); } }
    </style>
</div>
<?php endif; ?>

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

            <strong id="blueprint-filename">
                merdeka-hall-layout.pdf
            </strong>

            <div class="small muted mt-4" id="blueprint-size">
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

            <!-- Dynamic section boxes injected by JS -->
            <div id="dynamic-blueprint-boxes"></div>

        </div>

    </div>



    <!-- RIGHT SIDE -->

    <aside class="ts-card ts-card-pad">

        <div class="flex justify-between items-center">

            <div>

                <div class="ts-card-title">
                    Detected Sections
                </div>

                <div class="ts-card-sub" id="dynamic-sections-sub">
                    Loading...
                </div>

            </div>

            <?= ts_status(
                'Review',
                'warning'
            ) ?>

        </div>



        <div class="ts-section-editor mt-16" id="dynamic-editor-cards">
            <!-- Dynamic section editor cards injected by JS -->
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

            <span class="ts-generation-number" id="dynamic-seats-generated">
                0
            </span>

            <span class="small muted">
                Seats Generated
            </span>

        </div>


        <div class="ts-generation-divider"></div>


        <div class="ts-generation-stat">

            <span class="ts-generation-number" id="dynamic-sections-completed">
                0
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

    <div class="ts-generated-board" id="dynamic-generated-board">

        <div class="ts-generated-stage">
            STAGE
        </div>

        <!-- Dynamic generated section boxes injected by JS -->

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



        <div class="ts-generation-section-list mt-20" id="dynamic-generation-rows">
            <!-- Dynamic generation rows injected by JS -->
        </div>



        <div class="ts-generation-total mt-20">

            <span>
                Total Generated Seats
            </span>

            <strong id="dynamic-total-seats">
                0
            </strong>

        </div>



        <div class="ts-note mt-16" style="margin: 20px 0 20px 0;">

            <?= ts_icon('info') ?>

            <div class="small">

                Seat identifiers and assignment order have
                been generated automatically for every
                confirmed section.

            </div>

        </div>



        <div class="flex gap-12 mt-20">

            <a href="venue-layout.php?step=3" class="ts-btn ts-btn-secondary" id="step4-back-btn">
                Back
            </a>


            <a href="venue-layout.php?step=5" class="ts-btn ts-btn-primary" style="flex:1;" id="step4-continue-btn">
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


    <div class="ts-grid-3 mt-20" id="dynamic-seat-preview">
        <!-- Dynamic seat preview injected by JS -->
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



    <div class="ts-activation-summary mt-20" id="dynamic-activation-summary">
        <!-- Dynamic activation summary injected by JS -->
    </div>

</div>



<div class="ts-seat-generation-layout">


    <!-- LEFT FINAL LAYOUT -->

    <div class="ts-generated-board" id="dynamic-step5-board">

        <div class="ts-generated-stage">
            STAGE
        </div>

        <!-- Dynamic section boxes injected by JS -->

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

                    <div class="small muted" id="dynamic-checklist-sections">
                        Loading...
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

                    <div class="small muted" id="dynamic-checklist-seats">
                        Loading...
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

            <a href="venue-layout.php?step=4" class="ts-btn ts-btn-secondary" id="step5-back-btn">
                Back
            </a>


            <a href="venue-layout.php?step=5&activated=1" class="ts-btn ts-btn-primary" style="flex:1;" id="step5-activate-btn">
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


    <p class="secondary" id="activation-success-msg">

        This venue is now available for Event Organizers
        to select when creating new events.

    </p>



    <div class="ts-card ts-card-pad mt-24">

        <div class="ts-activation-result-grid">


            <div>

                <span class="small muted">
                    Venue
                </span>

                <strong id="dynamic-success-venue-name">
                    Loading...
                </strong>

            </div>


            <div>

                <span class="small muted">
                    Sections
                </span>

                <strong id="dynamic-success-sections">
                    0
                </strong>

            </div>


            <div>

                <span class="small muted">
                    Seats
                </span>

                <strong id="dynamic-success-seats">
                    0
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


        <a href="venue-detail.php" class="ts-btn ts-btn-primary" id="success-view-venue-btn">
            View Venue
        </a>

    </div>

</div>


<?php endif; ?>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
<script type="module">

window.addEventListener('ts-auth-ready', async () => {

    async function countSectionsInPDF(file) {
        return new Promise(async (resolve) => {
            try {
                const pdfjsLib = window['pdfjs-dist/build/pdf'];
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                const ab = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                const page = await pdf.getPage(1);
                const vp = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = vp.width; canvas.height = vp.height;
                await page.render({ canvasContext: ctx, viewport: vp }).promise;
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imgData.data, w = canvas.width, h = canvas.height;
                const vis = new Uint8Array(w * h);
                let boxCount = 0;
                for (let y = 0; y < h; y += 2) {
                    for (let x = 0; x < w; x += 2) {
                        let idx = y * w + x;
                        if (vis[idx]) continue;
                        let p = idx * 4;
                        if (d[p] < 200 && d[p+1] < 200 && d[p+2] < 200 && d[p+3] > 10) {
                            let minX=x, maxX=x, minY=y, maxY=y, stack=[idx];
                            vis[idx] = 1;
                            while (stack.length) {
                                let c = stack.pop(), cy = Math.floor(c/w), cx = c%w;
                                if (cx<minX) minX=cx; if (cx>maxX) maxX=cx;
                                if (cy<minY) minY=cy; if (cy>maxY) maxY=cy;
                                for (let n of [c-w,c+w,c-1,c+1,c-w*2,c+w*2,c-2,c+2]) {
                                    if (n>=0 && n<w*h && !vis[n]) {
                                        if (Math.abs(n%w-cx)>2) continue;
                                        let np=n*4;
                                        if (d[np]<200&&d[np+1]<200&&d[np+2]<200&&d[np+3]>10) { vis[n]=1; stack.push(n); }
                                    }
                                }
                            }
                            if ((maxX-minX)>w*0.1 && (maxY-minY)>h*0.05) boxCount++;
                        }
                    }
                }
                let sec = boxCount > 0 ? boxCount - 1 : 4;
                if (sec < 1) sec = 4;
                resolve(sec);
            } catch(e) { console.error('CV Error', e); resolve(4); }
        });
    }

    function generateSectionData(n) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const baseSeatCounts = [20,40,60,60,20,30,25,35,50,45];
        const out = [];
        for (let i = 0; i < n; i++) {
            const letter = letters[i] || 'S'+(i+1);
            out.push({ id:'sec-'+letter, name:'Section '+letter, letter, seats: baseSeatCounts[i] || (20+i*5) });
        }
        return out;
    }

    function calcPositions(n) {
        const pos = [], cols = 2, rows = Math.ceil(n/cols);
        const padX = 8, topStart = 22, availH = 72;
        const rowH = Math.min(20, Math.floor(availH/rows)-4);
        const gapY = Math.max(2, Math.floor((availH-rowH*rows)/(rows+1)));
        const boxW = (100-padX*2-4)/cols;
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i/cols), c = i%cols;
            pos.push({ top:(topStart+r*(rowH+gapY))+'%', left:(c===0?padX:(100-padX-boxW))+'%', width:boxW+'%', height:rowH+'%' });
        }
        return pos;
    }

    let activeIndex = 0;

    function renderDynamicUI(data, venueName) {
        const n = data.length;
        let totalSeats = data.reduce((s,d)=>s+d.seats,0);
        const pos = calcPositions(n);
        const pad2 = v => String(v).padStart(2,'0');

        function syncInputs() {
            const nameInp = document.getElementById('edit-section-name');
            const seatsInp = document.getElementById('edit-section-seats');
            if (nameInp && seatsInp) {
                data[activeIndex].name = nameInp.value;
                data[activeIndex].seats = parseInt(seatsInp.value) || 0;
            }
        }

        function renderStep3() {
            const bp = document.getElementById('dynamic-blueprint-boxes');
            const ec = document.getElementById('dynamic-editor-cards');
            if (!bp || !ec) return;

            bp.innerHTML = '';
            ec.innerHTML = '';
            
            data.forEach((s, i) => {
                const isAct = i === activeIndex;
                
                // Blueprint Box
                const d = document.createElement('div');
                d.className = 'ts-section-box' + (isAct ? ' active' : '');
                d.style.cssText = `left:${pos[i].left};top:${pos[i].top};width:${pos[i].width};height:${pos[i].height};position:absolute;cursor:pointer;transition:all 0.15s;`;
                d.textContent = s.name;
                d.onclick = () => {
                    syncInputs();
                    activeIndex = i;
                    renderStep3();
                };
                bp.appendChild(d);

                // Editor Card
                const c = document.createElement('div');
                c.className = 'ts-section-editor-card' + (isAct ? ' active' : '');
                if (isAct) {
                    c.innerHTML = `
                        <div class="flex justify-between">
                            <strong>Detected Section ${i+1}</strong>
                            <span class="ts-status ts-status-success">Valid</span>
                        </div>
                        <div class="ts-form-grid mt-12" onclick="event.stopPropagation()">
                            <div class="ts-field">
                                <label class="ts-label">Section Name</label>
                                <input class="ts-input" id="edit-section-name" value="${s.name}" oninput="window._tsUpdateData('name', this.value)">
                            </div>
                            <div class="ts-field">
                                <label class="ts-label">Seat Count</label>
                                <input class="ts-input" type="number" id="edit-section-seats" value="${s.seats}" oninput="window._tsUpdateData('seats', this.value)">
                            </div>
                        </div>`;
                } else {
                    c.innerHTML = `
                        <div class="flex justify-between">
                            <strong>Detected Section ${i+1}</strong>
                            <span class="ts-status ts-status-success">Valid</span>
                        </div>
                        <div class="small muted mt-8">${s.name} · ${s.seats} seats</div>`;
                    c.style.cursor = 'pointer';
                    c.onclick = () => {
                        syncInputs();
                        activeIndex = i;
                        renderStep3();
                    };
                }
                ec.appendChild(c);
            });

            const sub = document.getElementById('dynamic-sections-sub');
            if (sub) sub.textContent = n + ' sections identified';
        }

        window._tsUpdateData = (field, val) => {
            if (field === 'name') data[activeIndex].name = val;
            if (field === 'seats') data[activeIndex].seats = parseInt(val) || 0;
            
            // Re-render only the boxes so the user doesn't lose focus in the input field!
            const bp = document.getElementById('dynamic-blueprint-boxes');
            if (bp) {
                bp.children[activeIndex].textContent = data[activeIndex].name;
            }
        };

        function renderStaticSteps() {
            totalSeats = data.reduce((s,d)=>s+d.seats,0);

            // Step 4 summary
            const sg = document.getElementById('dynamic-seats-generated'); if (sg) sg.textContent=totalSeats;
            const sc = document.getElementById('dynamic-sections-completed'); if (sc) sc.textContent=n;

            // Step 4 board
            const gb = document.getElementById('dynamic-generated-board');
            if (gb) { gb.querySelectorAll('.ts-generated-section').forEach(e=>e.remove()); data.forEach((s,i)=>{ const d=document.createElement('div'); d.className='ts-generated-section'; d.style.cssText=`left:${pos[i].left};top:${pos[i].top};width:${pos[i].width};height:${pos[i].height};position:absolute;`; d.innerHTML=`<div class="ts-generated-section-content"><strong>${s.name}</strong><span>${s.seats} seats</span><span class="ts-generated-success">✓ Generated</span></div>`; gb.appendChild(d); }); }

            // Step 4 generation rows
            const gr = document.getElementById('dynamic-generation-rows');
            if (gr) { gr.innerHTML=''; data.forEach(s=>{ const r=document.createElement('div'); r.className='ts-generation-row'; r.innerHTML=`<div><strong>${s.name}</strong><div class="small muted">Seat ${s.letter}01 – ${s.letter}${pad2(s.seats)}</div></div><div class="text-right"><strong>${s.seats} / ${s.seats}</strong><div class="small success-text">Generated</div></div>`; gr.appendChild(r); }); }

            // Step 4 total
            const tt = document.getElementById('dynamic-total-seats'); if (tt) tt.textContent=totalSeats;

            // Step 4 seat preview
            const sp = document.getElementById('dynamic-seat-preview');
            if (sp) { sp.innerHTML=''; data.forEach(s=>{ const d=document.createElement('div'); const show=Math.min(s.seats,12), rem=s.seats-show; let pills=''; for(let i=1;i<=show;i++) pills+=`<span class="ts-seat-pill">${s.letter}${pad2(i)}</span>`; if(rem>0) pills+=`<span class="small muted">+${rem} more</span>`; d.innerHTML=`<strong>${s.name} · ${s.seats} seats</strong><div class="ts-seat-pills mt-12">${pills}</div>`; sp.appendChild(d); }); }

            // Step 5 activation summary
            const as = document.getElementById('dynamic-activation-summary');
            if (as) as.innerHTML=`<div class="ts-activation-item"><span class="small muted">Venue</span><strong>${venueName||'Venue'}</strong></div><div class="ts-activation-item"><span class="small muted">Sections</span><strong>${n}</strong></div><div class="ts-activation-item"><span class="small muted">Generated Seats</span><strong>${totalSeats}</strong></div><div class="ts-activation-item"><span class="small muted">Layout Status</span><strong>Ready</strong></div>`;

            // Step 5 board
            const s5b = document.getElementById('dynamic-step5-board');
            if (s5b) { s5b.querySelectorAll('.ts-generated-section').forEach(e=>e.remove()); data.forEach((s,i)=>{ const d=document.createElement('div'); d.className='ts-generated-section'; d.style.cssText=`left:${pos[i].left};top:${pos[i].top};width:${pos[i].width};height:${pos[i].height};position:absolute;`; d.innerHTML=`<div class="ts-generated-section-content"><strong>${s.name}</strong><span>${s.seats} seats</span></div>`; s5b.appendChild(d); }); }

            // Step 5 checklist
            const cs = document.getElementById('dynamic-checklist-sections'); if (cs) cs.textContent=n+' physical venue sections confirmed.';
            const cst = document.getElementById('dynamic-checklist-seats'); if (cst) cst.textContent=totalSeats+' physical seat records generated.';

            // Activation success
            const ss = document.getElementById('dynamic-success-sections'); if (ss) ss.textContent=n;
            const sst = document.getElementById('dynamic-success-seats'); if (sst) sst.textContent=totalSeats;
        }

        renderStep3();
        renderStaticSteps();

        window._tsDetectedSections = data;
        
        // Expose a way to grab latest data from inputs before saving
        window._tsSyncActiveInputs = syncInputs;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('id');
    const step = parseInt(urlParams.get('step')) || 1;
    if (!venueId) return;

    try {
        const venue = await window.tsVenues.getVenue(venueId);
        const nameEl = document.getElementById('blueprint-filename');
        const sizeEl = document.getElementById('blueprint-size');
        if (nameEl && sizeEl) {
            const mn = sessionStorage.getItem('mock_pdf_name_'+venueId);
            const ms = sessionStorage.getItem('mock_pdf_size_'+venueId);
            nameEl.textContent = mn || venue.blueprintName || 'blueprint.pdf';
            const fs = ms || venue.blueprintSize || 0;
            sizeEl.textContent = fs ? `PDF · ${(fs/(1024*1024)).toFixed(1)} MB` : 'PDF';
        }

        // Load custom sections from DB if available, otherwise generate defaults based on detected count
        let sectionData = [];
        if (venue.sections && Array.isArray(venue.sections) && venue.sections.length > 0) {
            venue.sections.forEach(s => {
                sectionData.push({
                    id: 'sec-' + s.sectionId,
                    name: s.name,
                    letter: s.sectionId,
                    seats: parseInt(s.seatCount, 10) || 0
                });
            });
        } else {
            const cnt = parseInt(sessionStorage.getItem('mock_pdf_count_'+venueId) || '5');
            sectionData = generateSectionData(cnt);
        }
        
        renderDynamicUI(sectionData, venue.name);

        // Wire Upload (Step 1)
        const realFileInput = document.getElementById('real-blueprint-file');
        if (realFileInput) {
            realFileInput.addEventListener('change', async (e) => {
                const errEl = document.getElementById('upload-error');
                const statusEl = document.getElementById('upload-status');
                errEl.style.display = 'none';
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.type !== 'application/pdf') { errEl.innerHTML='<strong>Error</strong><div class="small mt-8">Invalid format. Only PDF files are supported.</div>'; errEl.style.display='block'; e.target.value=''; return; }
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try { sessionStorage.clear(); sessionStorage.setItem('mock_pdf_'+venueId, ev.target.result); sessionStorage.setItem('mock_pdf_name_'+venueId, file.name); sessionStorage.setItem('mock_pdf_size_'+venueId, file.size); const c=await countSectionsInPDF(file); sessionStorage.setItem('mock_pdf_count_'+venueId, c); } catch(e){ console.warn('Storage err',e); }
                        try { statusEl.style.display='block'; window.tsVenues.uploadBlueprint(venueId,file).catch(e=>console.warn('Upload warning:',e)); statusEl.textContent='Blueprint uploaded. Proceeding to processing...'; setTimeout(()=>{window.location.href=`venue-layout.php?id=${venueId}&step=2`;},500); } catch(err){ errEl.innerHTML=`<strong>Error</strong><div class="small mt-8">${err.message}</div>`; errEl.style.display='block'; statusEl.style.display='none'; }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (step === 2) { setTimeout(()=>{window.location.href=`venue-layout.php?id=${venueId}&step=3`;},3000); }

        // Wire Replace (Step 3)
        const fileInput = document.querySelector('input[data-file-name="blueprint-file"]');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.type !== 'application/pdf') { alert('Only PDF files are supported.'); e.target.value=''; return; }
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try { sessionStorage.clear(); sessionStorage.setItem('mock_pdf_'+venueId, ev.target.result); sessionStorage.setItem('mock_pdf_name_'+venueId, file.name); sessionStorage.setItem('mock_pdf_size_'+venueId, file.size); const c=await countSectionsInPDF(file); sessionStorage.setItem('mock_pdf_count_'+venueId, c); } catch(e){ console.warn('Storage err',e); }
                        try { window.tsVenues.uploadBlueprint(venueId,file).catch(e=>console.warn('Upload warning:',e)); window.location.href=`venue-layout.php?id=${venueId}&step=2`; } catch(err){ alert(err.message); }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Wire Confirm (Step 3 → 4)
        const btnConfirm = document.querySelector('a[href="venue-layout.php?step=4"]');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    let payload = [];
                    let currentTotal = 0;
                    if (window._tsSyncActiveInputs) window._tsSyncActiveInputs();
                    (window._tsDetectedSections || sectionData).forEach(s => {
                        currentTotal += s.seats;
                        payload.push({
                            sectionId: s.letter,
                            name: s.name,
                            seatCount: s.seats
                        }); 
                    });

                    // Validation: Ensure total seats do not exceed venue capacity
                    const maxCapacity = parseInt(venue.capacity, 10) || 0;
                    if (maxCapacity > 0 && currentTotal > maxCapacity) {
                        alert(`Total seats (${currentTotal}) exceeds the venue's defined capacity (${maxCapacity}). Please adjust the section seat counts before continuing.`);
                        return;
                    }

                    await window.tsVenues.updateSections(venueId, payload);
                    window.location.href = `venue-layout.php?id=${venueId}&step=4`;
                } catch(err) { alert(err.message); }
            });
        }

        // Wire Activate (Step 5)
        const btnActivate = document.querySelector('#step5-activate-btn');
        if (btnActivate) {
            btnActivate.addEventListener('click', async (e) => {
                e.preventDefault();
                btnActivate.textContent = 'Activating...';
                btnActivate.style.pointerEvents = 'none';
                try { 
                    await window.tsVenues.activateLayout(venueId); 
                    window.location.href = `venue-layout.php?id=${venueId}&step=5&activated=1`; 
                } catch(err) { 
                    alert(err.message); 
                    btnActivate.textContent = 'Activate Venue Layout';
                    btnActivate.style.pointerEvents = '';
                }
            });
        }

        // Fix all navigation links to include venueId
        const step4Back = document.getElementById('step4-back-btn');
        if (step4Back) step4Back.href = `venue-layout.php?id=${venueId}&step=3`;
        const step4Continue = document.getElementById('step4-continue-btn');
        if (step4Continue) step4Continue.href = `venue-layout.php?id=${venueId}&step=5`;
        const step5Back = document.getElementById('step5-back-btn');
        if (step5Back) step5Back.href = `venue-layout.php?id=${venueId}&step=4`;

        // Populate activation success page
        const successVenueName = document.getElementById('dynamic-success-venue-name');
        if (successVenueName) successVenueName.textContent = venue.name || 'Venue';
        const successMsg = document.getElementById('activation-success-msg');
        if (successMsg) successMsg.textContent = `${venue.name || 'This venue'} is now available for Event Organizers to select when creating new events.`;
        const successSections = document.getElementById('dynamic-success-sections');
        if (successSections) {
            const secs = Array.isArray(venue.sections) ? venue.sections : [];
            successSections.textContent = secs.length;
        }
        const successSeats = document.getElementById('dynamic-success-seats');
        if (successSeats) {
            const secs = Array.isArray(venue.sections) ? venue.sections : [];
            let total = 0;
            secs.forEach(s => { total += (parseInt(s.seatCount, 10) || 0); });
            successSeats.textContent = total;
        }
        const viewVenueBtn = document.getElementById('success-view-venue-btn');
        if (viewVenueBtn) viewVenueBtn.href = `venue-detail.php?id=${venueId}`;

    } catch (err) { console.error(err); }
});
</script>

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