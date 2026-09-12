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
                <div class="ts-field"><label class="ts-label" for="complaint-category">Complaint Category</label><select class="ts-select" id="complaint-category" name="complaintCategory" required>
                        <option value="">Select a category</option>
                        <option value="Payment issue">Payment issue</option>
                        <option value="Ticket ownership dispute">Ticket ownership dispute</option>
                        <option value="Resale dispute">Resale dispute</option>
                        <option value="Refund request">Refund request</option>
                        <option value="Suspected fraud">Suspected fraud</option>
                        <option value="Account issue">Account issue</option>
                    </select></div>
                <div class="ts-field"><label class="ts-label" for="select-booking">Related Booking</label><select class="ts-select" name="relatedBooking" id="select-booking">
                        <option value="">Loading bookings...</option>
                    </select></div>
                <div class="ts-field span-2"><label class="ts-label" for="complaint-description">Description</label><textarea class="ts-textarea" id="complaint-description" name="complaintDescription" minlength="10" maxlength="5000" required
                        placeholder="Describe what happened, when it happened and what outcome you are requesting."></textarea>
                </div>
                <div class="ts-field span-2"><label class="ts-label">Supporting Evidence</label><label
                        class="ts-dropzone"><input type="file" name="evidence" style="display:none" data-file-name="evidence-name" id="file-evidence" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"><span
                            class="ts-drop-icon"><?=ts_icon('upload')?></span><strong>Choose
                            a file or drag it here</strong>
                        <div id="evidence-name" class="small muted mt-8">PNG, JPG or PDF</div>
                    </label></div>
            </div>
            <div class="flex justify-between mt-24"><a class="ts-btn ts-btn-secondary"
                    href="complaints.php">Cancel</a><button class="ts-btn ts-btn-primary"
                    id="btn-submit" type="button">Submit Complaint</button></div>
        </div>
    </div>
</main>

<script type="module">
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('ts-auth-ready', async () => {
        const allowedBookingIds = new Set();
        try {
            const bookings = await window.tsBookings.getUserBookings();
            const selectBooking = document.getElementById('select-booking');
            
            let html = '<option value="">None / Not applicable</option>';
            bookings.forEach(b => {
                allowedBookingIds.add(String(b.id));
                html += `<option value="${b.id}">${b.bookingNumber || b.id} · ${b.eventName}</option>`;
            });
            selectBooking.innerHTML = html;
            
        } catch (err) {
            console.error('Error loading bookings:', err);
            document.getElementById('select-booking').innerHTML = '<option value="">Failed to load bookings</option>';
        }

        const form = document.getElementById('complaint-form');
        const submitBtn = document.getElementById('btn-submit');
        const container = document.getElementById('complaint-form-container');
        const fileInput = document.getElementById('file-evidence');
        const clearEvidenceError = () => {
            fileInput.style.borderColor = '';
            fileInput.style.boxShadow = '';
            fileInput.parentElement.querySelectorAll('.ts-error-msg').forEach(node => { node.style.display = 'none'; });
        };

        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const V = window.tsValidation;
            if (!V) return;
            V.clearFieldErrors(form);
            clearEvidenceError();

            const selectedBookingId = V.val(form, 'relatedBooking');
            const evidence = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;

            let ok = V.runAll([
                { check: () => V.validateSelect(V.val(form, 'complaintCategory'), 'complaint category'), el: V.el(form, 'complaintCategory') },
                { check: () => V.validateRequired(V.val(form, 'complaintDescription'), 'Description'), el: V.el(form, 'complaintDescription') },
                { check: () => V.validateMinLength(V.val(form, 'complaintDescription'), 10, 'Description'), el: V.el(form, 'complaintDescription') },
                { check: () => V.validateMaxLength(V.val(form, 'complaintDescription'), 5000, 'Description'), el: V.el(form, 'complaintDescription') }
            ]);
            if (selectedBookingId && !allowedBookingIds.has(selectedBookingId)) {
                V.showFieldError(V.el(form, 'relatedBooking'), 'Choose one of your own bookings or select Not applicable.');
                ok = false;
            }
            if (evidence) {
                const evidenceValid = V.runAll([
                    { check: () => V.validateFileType(evidence, ['image/png', 'image/jpeg', 'application/pdf']), el: fileInput },
                    { check: () => V.validateFileSize(evidence, 10 * 1024 * 1024), el: fileInput }
                ]);
                ok = evidenceValid && ok;
            }
            
            if (!ok) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            try {
                await window.tsComplaints.createComplaint({
                    category: V.val(form, 'complaintCategory'),
                    description: V.val(form, 'complaintDescription'),
                    relatedBookingId: selectedBookingId,
                    evidenceFile: evidence
                });
                window.location.href = 'complaints.php';
            } catch (err) {
                V.showGlobalError(container, 'Submission Error', err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Complaint';
            }
        });
        
        // Handle file name display
        fileInput.addEventListener('change', () => {
            clearEvidenceError();
            if (fileInput.files.length > 0) {
                document.getElementById('evidence-name').textContent = fileInput.files[0].name;
            } else {
                document.getElementById('evidence-name').textContent = 'PNG, JPG or PDF (maximum 10 MB)';
            }
        });
    });
});
</script>

<?php
$content = ob_get_clean();
render_public_page('New Complaint', 'tickets', $content, '..', true);
?>
