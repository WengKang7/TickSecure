import { AccountCrud } from './role-crud.js';
import { invokeTrustedBackend } from './backend-client.js?v=20261104-admin-accounts';
import { validateFullName, validatePassword, validateEmail, validatePhone } from './validation.js';

const form = document.getElementById('account-form');
const message = document.getElementById('account-message');
const save = document.getElementById('account-save');
const password = form.elements.password;
const showPassword = document.getElementById('password-show');
showPassword.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    showPassword.textContent = show ? 'Hide password' : 'Show password';
    showPassword.setAttribute('aria-pressed', String(show));
});
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
            role.value = user.role;
            form.elements.password.required = false;
            document.getElementById('password-label').textContent = 'New password (optional)';
            document.getElementById('password-help').textContent = 'Leave blank to keep the current password. Existing passwords cannot be retrieved. A new password requires uppercase, lowercase, a number and a special character. Changing the email requires verification of the new address.';
            {
                const org = await window.tsUsers.getOrganizerProfile(id);
                orgFields.forEach(key => { form.elements[key].value = org?.[key] || ''; });
            }
            if (user.status === 'deleted') throw new Error('This account has been deleted. Its history is retained.');
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
    const validations = [validateFullName(data.fullName), validateEmail(data.email)];
    if (!id || data.password) validations.push(validatePassword(data.password));
    if (role.value === 'organizer') validations.push(validatePhone(data.organizationPhone));
    const invalid = validations.find(result => !result.valid);
    if (invalid) { message.textContent = invalid.error; return; }
    save.disabled = true;
    try {
        if (!await window.tsDecision(id ? 'updateAccount' : 'createAccount', data.fullName,
            [['Email', form.elements.email.value], ['Role', role.value === 'organizer' ? 'Event Organizer' : 'Buyer']])) return;
        message.textContent = 'Saving account…';
        if (id) {
            const result = await invokeTrustedBackend({ ...data, userId: id, action: 'edit' }, { name: 'manageAdminAccount', region: 'asia-southeast1' });
            password.value = '';
            password.type = 'password';
            showPassword.textContent = 'Show password';
            showPassword.setAttribute('aria-pressed', 'false');
            message.textContent = result.emailChanged ? 'Account saved. The user must verify their new email when signing in.' : 'Account saved.';
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
    finally { save.disabled = !ready; }
});
