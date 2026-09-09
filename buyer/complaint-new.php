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
        <div class="ts-card ts-card-pad" id="complaint-form-container">
            <div class="ts-form-grid" id="complaint-form">
                <div class="ts-field"><label class="ts-label">Complaint Category</label><select class="ts-select" name="complaintCategory">
                        <option value="">Select a category</option>
                        <option value="Payment issue">Payment issue</option>
                        <option value="Ticket ownership dispute">Ticket ownership dispute</option>
                        <option value="Resale dispute">Resale dispute</option>
                        <option value="Refund request">Refund request</option>
                        <option value="Suspected fraud">Suspected fraud</option>
                        <option value="Account issue">Account issue</option>
                    </select></div>
                <div class="ts-field"><label class="ts-label">Related Booking</label><select class="ts-select" name="relatedBooking" id="select-booking">
                        <option value="">Loading bookings...</option>
                    </select></div>
                <div class="ts-field span-2"><label class="ts-label">Description</label><textarea class="ts-textarea" name="complaintDescription"
                        placeholder="Describe what happened, when it happened and what outcome you are requesting."></textarea>
                </div>
                <div class="ts-field span-2"><label class="ts-label">Supporting Evidence</label><label
                        class="ts-dropzone"><input type="file" name="evidence" style="display:none" data-file-name="evidence-name" id="file-evidence"><span
                            class="ts-drop-icon"><?=ts_icon('upload')?></span><strong>Choose
                            a file or drag it here</strong>
                        <div id="evidence-name" class="small muted mt-8">PNG, JPG or PDF</div>
                    </label></div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="complaints.php">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit">Submit Complaint</button></div>
        </div>
    </div>
</main>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('ts-auth-ready', async () => {
        try {
            const bookings = await window.tsBookings.getUserBookings();
            const selectBooking = document.getElementById('select-booking');
            
            let html = '<option value="">None / Not applicable</option>';
            bookings.forEach(b => {
                html += \`<option value="\${b.id}">\${b.id} · \${b.eventName}</option>\`;
            });
            selectBooking.innerHTML = html;
            
        } catch (err) {
            console.error('Error loading bookings:', err);
            document.getElementById('select-booking').innerHTML = '<option value="">Failed to load bookings</option>';
        }

        const form = document.getElementById('complaint-form');
        const submitBtn = document.getElementById('btn-submit');
        const container = document.getElementById('complaint-form-container');

        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const V = window.tsValidation;
            V.clearFieldErrors(form);

            const ok = V.runAll([
                { check: () => V.validateRequired(V.val(form, 'complaintCategory'), 'Category'), el: V.el(form, 'complaintCategory') },
                { check: () => V.validateRequired(V.val(form, 'complaintDescription'), 'Description'), el: V.el(form, 'complaintDescription') },
                { check: () => V.validateMinLength(V.val(form, 'complaintDescription'), 10, 'Description'), el: V.el(form, 'complaintDescription') },
                { check: () => V.validateMaxLength(V.val(form, 'complaintDescription'), 5000, 'Description'), el: V.el(form, 'complaintDescription') }
            ]);
            
            if (!ok) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            const fileInput = document.getElementById('file-evidence');
            const file = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;

            try {
                await window.tsComplaints.createComplaint({
                    category: V.val(form, 'complaintCategory'),
                    description: V.val(form, 'complaintDescription'),
                    relatedBookingId: V.val(form, 'relatedBooking'),
                    evidenceFile: file
                });
                window.location.href = 'complaints.php';
            } catch (err) {
                V.showGlobalError(container, 'Submission Error', err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Complaint';
            }
        });
        
        // Handle file name display
        const fileInput = document.getElementById('file-evidence');
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                document.getElementById('evidence-name').textContent = fileInput.files[0].name;
            }
        });
    });
});
</script>

<?php
$content = ob_get_clean();
render_public_page('New Complaint', 'tickets', $content, '..', true);
?>