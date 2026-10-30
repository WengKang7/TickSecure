import { ComplaintCrud } from './role-crud.js';
const id = new URLSearchParams(location.search).get('id');
const form = document.getElementById('manage-complaint-form');
const message = document.getElementById('manage-message');
const save = document.getElementById('manage-save');
const remove = document.getElementById('manage-delete');
let initialized = false;
async function initialize() {
    if (initialized || !window.tsCurrentUser?.uid) return;
    initialized = true;
    try {
        if (!id) throw new Error('A complaint ID is required.');
        const complaint = await window.tsComplaints.getComplaint(id);
        if (!complaint || complaint.complainantUid !== window.tsCurrentUser.uid) throw new Error('Complaint not found.');
        document.getElementById('complaint-meta').textContent = `${complaint.referenceNumber || id} · ${complaint.status} · ${complaint.updatedAt || complaint.createdAt}`;
        form.elements.category.value = complaint.category || '';
        form.elements.description.value = complaint.description || '';
        const editable = complaint.status === 'OPEN';
        form.elements.category.disabled = form.elements.description.disabled = !editable;
        save.hidden = remove.hidden = !editable;
        const progress = document.getElementById('complaint-progress');
        const entries = [...(complaint.timeline || [])];
        if (complaint.resolutionExplanation) entries.push({ status: 'Resolution', note: complaint.resolutionExplanation });
        if (complaint.rejectionReason) entries.push({ status: 'Reason', note: complaint.rejectionReason });
        entries.forEach(entry => {
            const item = document.createElement('p');
            item.textContent = `${entry.status || 'Update'}: ${entry.note || ''} ${entry.timestamp || ''}`;
            progress.append(item);
        });
        (complaint.evidenceUrls || []).forEach(value => {
            let url;
            try {
                url = new URL(value);
                if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return;
            } catch (_) {
                if (window.tsFirebase?.backend?.mode !== 'php' || !/^uploads\/local\/\d{4}\/\d{2}\/[a-f0-9]{40}\.(jpg|png|pdf)$/.test(value)) return;
                url = new URL(value, window.tsFirebase.backend.projectUrl);
                if (url.origin !== location.origin) return;
            }
            const link = document.createElement('a');
            link.href = url.href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'View evidence';
            document.getElementById('complaint-evidence').append(link);
        });
    } catch (error) { message.textContent = error.message; }
}
window.addEventListener('ts-auth-ready', initialize);
if (window.tsCurrentUser?.uid) initialize();
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.hidden || save.disabled || !form.reportValidity()) return;
    save.disabled = remove.disabled = true;
    try {
        await ComplaintCrud.update(id, Object.fromEntries(new FormData(form)));
        message.textContent = 'Complaint saved.';
    } catch (error) { message.textContent = error.message; }
    finally { save.disabled = remove.disabled = false; }
});
remove.addEventListener('click', async () => {
    if (remove.disabled) return;
    save.disabled = remove.disabled = true;
    try {
        if (!await window.tsDecision('deleteComplaint', document.getElementById('complaint-meta').textContent)) return;
        await ComplaintCrud.delete(id); location.href = 'complaints.php';
    } catch (error) { message.textContent = error.message; }
    finally { save.disabled = remove.disabled = false; }
});
