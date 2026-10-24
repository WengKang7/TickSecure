<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('User Management', 'Search registered Buyers and Event Organizers, review account status and apply access controls.', '<button class="ts-btn ts-btn-secondary">'.ts_icon('download').' Export</button>')?>
<div class="ts-card">
    <div class="ts-filter-bar ts-user-filters">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input id="user-search" class="ts-input" type="search" aria-label="Search users by name or email" placeholder="Search name or email">
        </div>
        <select id="user-role-filter" class="ts-select" aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="buyer">Buyer</option>
            <option value="organizer">Event Organizer</option>
        </select>
        <select id="user-status-filter" class="ts-select" aria-label="Filter by account status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
        </select>
        <select id="user-verification-filter" class="ts-select" aria-label="Filter by email verification">
            <option value="">All verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
        </select>
    </div>
    <div class="ts-table-wrap">
        <table class="ts-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    <th>Email Verified</th>
                    <th>Created</th>
                    <th>Last Activity</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="users-table-body">
                <tr><td colspan="8" class="text-center secondary" style="padding:40px">Loading users...</td></tr>
            </tbody>
        </table>
    </div>
    <div class="ts-pagination gap-12 wrap">
        <span id="users-count" role="status" aria-live="polite">Loading users...</span>
        <nav class="flex items-center gap-12 wrap" aria-label="User list pages">
            <button id="users-previous" class="ts-btn ts-btn-secondary ts-btn-sm" type="button" disabled>Previous</button>
            <span id="users-page" aria-live="polite">Page 1 of 1</span>
            <button id="users-next" class="ts-btn ts-btn-secondary ts-btn-sm" type="button" disabled>Next</button>
        </nav>
    </div>
</div>

<script type="module">
const tbody = document.getElementById('users-table-body');
const count = document.getElementById('users-count');
const search = document.getElementById('user-search');
const roleFilter = document.getElementById('user-role-filter');
const statusFilter = document.getElementById('user-status-filter');
const verificationFilter = document.getElementById('user-verification-filter');
const previousButton = document.getElementById('users-previous');
const nextButton = document.getElementById('users-next');
const pageLabel = document.getElementById('users-page');
const PAGE_SIZE = 5;
let currentPage = 1;
let allUsers = [];
let loaded = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const formatDate = value => {
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value || '');
    return Number.isNaN(date.valueOf()) ? 'N/A' : date.toLocaleDateString();
};

function renderUsers() {
    if (!loaded) return;
    const query = search.value.trim().toLowerCase();
    const users = allUsers.filter(user => {
        const verified = user.emailVerified === true;
        return (!query || `${user.fullName || ''} ${user.email || ''}`.toLowerCase().includes(query))
            && (!roleFilter.value || user.role === roleFilter.value)
            && (!statusFilter.value || user.status === statusFilter.value)
            && (!verificationFilter.value || verified === (verificationFilter.value === 'verified'));
    });
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageUsers = users.slice(start, start + PAGE_SIZE);
    const filterSummary = users.length === allUsers.length ? '' : ` (filtered from ${allUsers.length})`;
    count.textContent = (users.length
        ? `Showing ${start + 1}–${start + pageUsers.length} of ${users.length} users`
        : 'Showing 0 users') + filterSummary;
    pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
    previousButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center secondary" style="padding:40px">${allUsers.length ? 'No users match your filters.' : 'No buyers or event organizers found.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = pageUsers.map(user => {
        const statusTone = user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : 'neutral';
        const verified = user.emailVerified === true;
        const roleTone = user.role === 'organizer' ? 'warning' : 'neutral';
        let action = '';
        if (user.status === 'active') {
            action = `<button class="ts-btn ts-btn-secondary ts-btn-sm text-error" data-user-action="suspend" data-id="${esc(user.id)}">Suspend</button>`;
        } else if (user.status === 'suspended') {
            action = `<button class="ts-btn ts-btn-secondary ts-btn-sm text-success" data-user-action="reactivate" data-id="${esc(user.id)}">Reactivate</button>`;
        }
        return `<tr>
            <td class="cell-title">${esc(user.fullName || 'No Name')}</td>
            <td>${esc(user.email)}</td>
            <td><span class="ts-chip ts-chip-${roleTone}">${user.role === 'organizer' ? 'Event Organizer' : 'Buyer'}</span></td>
            <td><span class="ts-chip ts-chip-${statusTone}">${esc(user.status || 'Unknown')}</span></td>
            <td><span class="ts-chip ts-chip-${verified ? 'success' : 'neutral'}">${verified ? 'Verified' : 'Unverified'}</span></td>
            <td>${esc(formatDate(user.createdAt))}</td>
            <td>${esc(formatDate(user.lastActivityAt))}</td>
            <td class="flex gap-4">
                <a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php?id=${encodeURIComponent(user.id)}">View</a>
                ${action}
            </td>
        </tr>`;
    }).join('');
}

async function loadUsers() {
    try {
        // Keep administrator accounts out of this management list and its counts.
        allUsers = (await window.tsUsers.getUsers()).filter(user => ['buyer', 'organizer'].includes(user.role));
        loaded = true;
        renderUsers();
    } catch (error) {
        loaded = false;
        console.error('Load users error:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center secondary" style="padding:40px">Unable to load users. Please refresh and try again.</td></tr>';
        count.textContent = 'Users could not be loaded';
        previousButton.disabled = true;
        nextButton.disabled = true;
        pageLabel.textContent = 'Pages unavailable';
    }
}

function applyFilters() {
    currentPage = 1;
    renderUsers();
}
search.addEventListener('input', applyFilters);
[roleFilter, statusFilter, verificationFilter].forEach(filter => filter.addEventListener('change', applyFilters));
previousButton.addEventListener('click', () => {
    if (!loaded || previousButton.disabled) return;
    currentPage--;
    renderUsers();
});
nextButton.addEventListener('click', () => {
    if (!loaded || nextButton.disabled) return;
    currentPage++;
    renderUsers();
});

tbody.addEventListener('click', async event => {
    const button = event.target.closest('[data-user-action]');
    if (!button || button.disabled || !tbody.contains(button)) return;
    const user = allUsers.find(item => item.id === button.dataset.id);
    if (!user) return;
    const action = button.dataset.userAction;
    if (!['suspend', 'reactivate'].includes(action)) return;
    const reason = action === 'suspend' ? prompt('Reason for suspension:')?.trim() : '';
    if (action === 'suspend' && !reason) return;
    if (action === 'reactivate' && !confirm('Reactivate this user?')) return;
    button.disabled = true;
    try {
        if (action === 'suspend') await window.tsUsers.suspendUser(user.id, reason);
        else await window.tsUsers.reactivateUser(user.id);
        // Reload data without resetting the current search or dropdown choices.
        await loadUsers();
    } catch (error) {
        alert(error.message || 'The account could not be updated.');
    } finally {
        button.disabled = false;
    }
});

window.addEventListener('ts-auth-ready', event => {
    if (event.detail?.role === 'admin') return loadUsers();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'User Management', 'users', $content, '..', '');
?>
