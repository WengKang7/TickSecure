import { AccountCrud } from './role-crud.js';
import { db } from './firebase-init.js';
import { doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { validateFullName, validatePassword, validateEmail, validatePhone } from './validation.js';

const form = document.getElementById('account-form');
const message = document.getElementById('account-message');
const save = document.getElementById('account-save');
const archive = document.getElementById('account-archive');
const id = new URLSearchParams(location.search).get('id');
const orgFields = ['organizationName', 'organizationPhone', 'organizationAddress', 'organizationDescription'];
const role = form.elements.role;
let initialized = false, ready = false;
function organizationVisibility() {
    const fields = document.getElementById('organization-fields');
    fields.hidden = fields.disabled = role.value !== 'organizer';
}
role.addEventListener('change', organizationVisibility);
async function initialize() {
    if (initialized || window.tsCurrentUser?.role !== 'admin') return;
    initialized = true;
    try {
        if (id) {
            const user = await window.tsUsers.getUser(id);
            if (!user || !['buyer', 'organizer'].includes(user.role)) throw new Error('Buyer or organizer account not found.');
            form.elements.fullName.value = user.fullName || '';
            form.elements.email.value = user.email || '';
            form.elements.email.disabled = role.disabled = true;
            role.value = user.role;
            form.elements.password.required = false;
            form.elements.password.disabled = true;
            document.getElementById('password-field').hidden = true;
            if (user.role === 'organizer') {
                const org = await window.tsUsers.getOrganizerProfile(id);
                orgFields.forEach(key => { form.elements[key].value = org?.[key] || ''; });
            }
            archive.hidden = user.status === 'deleted';
            document.getElementById('archive-help').hidden = false;
            if (user.status === 'deleted') throw new Error('This account has been archived. Its history is retained.');
        }
        organizationVisibility();
        ready = true;
        save.disabled = false;
    } catch (error) { message.textContent = error.message; }
}
window.addEventListener('ts-auth-ready', initialize);
if (window.tsCurrentUser) initialize();
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || save.disabled || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    const validations = [validateFullName(data.fullName)];
    if (!id) validations.push(validateEmail(data.email), validatePassword(data.password));
    if (role.value === 'organizer') validations.push(validatePhone(data.organizationPhone));
    const invalid = validations.find(result => !result.valid);
    if (invalid) { message.textContent = invalid.error; return; }
    save.disabled = archive.disabled = true;
    try {
        if (!await window.tsDecision(id ? 'updateAccount' : 'createAccount', data.fullName,
            [['Email', form.elements.email.value], ['Role', role.value === 'organizer' ? 'Event Organizer' : 'Buyer']])) return;
        message.textContent = 'Saving account…';
        if (id) {
            const batch = writeBatch(db);
            batch.update(doc(db, 'Users', id), { fullName: data.fullName.trim(), updatedAt: new Date().toISOString() });
            if (role.value === 'organizer') batch.set(doc(db, 'OrganizerProfiles', id), Object.fromEntries(orgFields.map(key => [key, data[key].trim()])));
            await batch.commit();
            message.textContent = 'Account saved.';
        } else {
            const result = await AccountCrud.create(data);
            form.reset();
            ready = false;
            message.textContent = result.verificationSent ? 'Account created. A verification email has been sent.' : 'Account created. The user can resend their verification email when signing in.';
            const link = document.createElement('a');
            link.href = `user-detail.php?id=${encodeURIComponent(result.id)}`;
            link.textContent = ' View account';
            message.append(link);
        }
    } catch (error) { message.textContent = error.message || 'Unable to save account.'; }
    finally { save.disabled = !ready; archive.disabled = false; }
});
archive.addEventListener('click', async () => {
    if (!id || archive.disabled) return;
    archive.disabled = save.disabled = true;
    try {
        if (!await window.tsDecision('archiveAccount', form.elements.fullName.value, [['Email', form.elements.email.value]])) return;
        await AccountCrud.archive(id); location.href = 'users.php';
    } catch (error) { message.textContent = error.message; }
    finally { archive.disabled = save.disabled = false; }
});
