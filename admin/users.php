<?php
require_once __DIR__ . '/../shared/ui.php';
$accountRole = ($accountRole ?? 'buyer') === 'organizer' ? 'organizer' : 'buyer';
$isOrganizerList = $accountRole === 'organizer';
$listTitle = $isOrganizerList ? 'Organizer Management' : 'User Management';
$listSubtitle = $isOrganizerList
    ? 'Search active Event Organizers and manage their accounts. Pending registrations appear in Organizer Applications.'
    : 'Search registered Buyers, review account status and apply access controls.';
ob_start();
?>

<?=ts_page_head($listTitle, $listSubtitle, '<button id="users-print" class="ts-btn ts-btn-secondary" type="button" disabled>Print</button> <button id="users-export" class="ts-btn ts-btn-secondary" type="button" disabled>'.ts_icon('download').' Export CSV</button>')?>
<div class="ts-card">
    <div class="ts-card-pad"><a class="ts-btn ts-btn-primary" href="account-edit.php">Create account</a></div>
    <div class="ts-filter-bar ts-user-filters">
        <div class="ts-input-wrap ts-search">
            <?=ts_icon('search')?><input id="user-search" class="ts-input" type="search" aria-label="Search users by name or email" placeholder="Search name or email">
        </div>
        <select id="user-status-filter" class="ts-select" aria-label="Filter by account status" <?=$isOrganizerList ? 'disabled' : ''?>>
            <?php if ($isOrganizerList): ?>
            <option value="active" selected>Active organizers only</option>
            <?php else: ?>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended (legacy)</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="deleted">Deleted</option>
            <?php endif; ?>
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
                    <th><?=$isOrganizerList ? 'Organizer' : 'User'?></th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    <th>Email Verified</th>
                    <th>Created</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="users-table-body" data-account-role="<?=$accountRole?>">
                <tr><td colspan="7" class="text-center secondary" style="padding:40px">Loading users...</td></tr>
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
const accountRole = tbody.dataset.accountRole === 'organizer' ? 'organizer' : 'buyer';
const accountLabel = accountRole === 'organizer' ? 'organizers' : 'users';
const statusFilter = document.getElementById('user-status-filter');
const verificationFilter = document.getElementById('user-verification-filter');
const previousButton = document.getElementById('users-previous');
const nextButton = document.getElementById('users-next');
const pageLabel = document.getElementById('users-page');
const exportButton = document.getElementById('users-export');
const printButton = document.getElementById('users-print');
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

function filteredUsers() {
    const query = search.value.trim().toLowerCase();
    return allUsers.filter(user => {
        const verified = user.emailVerified === true;
        return (!query || `${user.fullName || ''} ${user.email || ''}`.toLowerCase().includes(query))
            && (!statusFilter.value || user.status === statusFilter.value)
            && (!verificationFilter.value || verified === (verificationFilter.value === 'verified'));
    });
 }

function renderUsers() {
    if (!loaded) return;
    const users = filteredUsers();
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageUsers = users.slice(start, start + PAGE_SIZE);
    const filterSummary = users.length === allUsers.length ? '' : ` (filtered from ${allUsers.length})`;
    count.textContent = (users.length
        ? `Showing ${start + 1}–${start + pageUsers.length} of ${users.length} ${accountLabel}`
        : `Showing 0 ${accountLabel}`) + filterSummary;
    pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
    previousButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center secondary" style="padding:40px">${allUsers.length ? `No ${accountLabel} match your filters.` : (accountRole === 'organizer' ? 'No event organizers found.' : 'No buyers found.')}</td></tr>`;
        return;
    }
    tbody.innerHTML = pageUsers.map(user => {
        const statusTone = user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : 'neutral';
        const verified = user.emailVerified === true;
        const roleTone = user.role === 'organizer' ? 'warning' : 'neutral';
        let action = '';
        if (user.status !== 'deleted') {
            action = `<button class="ts-btn ts-btn-secondary ts-btn-sm text-error" data-user-action="delete" data-id="${esc(user.id)}">Delete</button>`;
            if (['inactive', 'suspended'].includes(user.status)) action += `<button class="ts-btn ts-btn-secondary ts-btn-sm" data-user-action="reactivate" data-id="${esc(user.id)}">Reactivate</button>`;
        }
        return `<tr>
            <td class="cell-title">${esc(user.fullName || 'No Name')}</td>
            <td>${esc(user.email)}</td>
            <td><span class="ts-chip ts-chip-${roleTone}">${user.role === 'organizer' ? 'Event Organizer' : 'Buyer'}</span></td>
            <td><span class="ts-chip ts-chip-${statusTone}">${esc(user.status || 'Unknown')}</span></td>
            <td><span class="ts-chip ts-chip-${verified ? 'success' : 'neutral'}">${verified ? 'Verified' : 'Unverified'}</span></td>
            <td>${esc(formatDate(user.createdAt))}</td>
            <td class="flex gap-4">
                <a class="ts-btn ts-btn-secondary ts-btn-sm" href="user-detail.php?id=${encodeURIComponent(user.id)}">View</a>
                ${action}
            </td>
        </tr>`;
    }).join('');
}

async function loadUsers() {
    try {
        // Each list and its counts contain only the account type selected by this page.
        const filters = accountRole === 'organizer' ? { role: accountRole, status: 'active' } : { role: accountRole };
        allUsers = (await window.tsUsers.getUsers(filters)).filter(user => user.role === accountRole
            && (accountRole !== 'organizer' || user.status === 'active'));
        loaded = true;
        exportButton.disabled = printButton.disabled = false;
        renderUsers();
    } catch (error) {
        loaded = false;
        exportButton.disabled = printButton.disabled = true;
        console.error('Load users error:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center secondary" style="padding:40px">Unable to load ${accountLabel}. Please refresh and try again.</td></tr>`;
        count.textContent = `${accountRole === 'organizer' ? 'Organizers' : 'Users'} could not be loaded`;
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
[statusFilter, verificationFilter].forEach(filter => filter.addEventListener('change', applyFilters));
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
    if (!['delete', 'reactivate'].includes(action)) return;
    const decision = await window.tsAdminConfirm(action === 'delete' ? 'deleteUser' : 'reactivateUser', user.fullName || user.email || 'Selected account', [['Email', user.email || 'Not provided']]);
    if (!decision) return;
    button.disabled = true;
    try {
        if (action === 'delete') await window.tsUsers.deleteUser(user.id);
        else await window.tsUsers.reactivateUser(user.id);
        // Reload data without resetting the current search or dropdown choices.
        await loadUsers();
    } catch (error) {
        alert(error.message || 'The account could not be updated.');
    } finally {
        button.disabled = false;
    }
});

// Reports include every filtered row, including rows on other pages.
const reportHeadings = ['Name', 'Email', 'Role', 'Account status', 'Email verified', 'Created'];
const reportRow = user => [user.fullName || 'No Name', user.email || '', user.role, user.status,
    user.emailVerified === true ? 'Verified' : 'Unverified', formatDate(user.createdAt)];
exportButton.addEventListener('click', () => {
    if (!loaded || exportButton.disabled) return;
    const csvCell = value => {
        let text = String(value ?? '');
        if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    };
    const csv = [reportHeadings, ...filteredUsers().map(reportRow)].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `ticksecure-${accountLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
let printFrame;
printButton.addEventListener('click', () => {
    if (!loaded || printButton.disabled) return;
    printFrame?.remove();
    const frame = document.createElement('iframe');
    printFrame = frame;
    frame.title = 'Account report for printing';
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    const users = filteredUsers(), title = accountRole === 'organizer' ? 'Organizer Management' : 'User Management';
    const filters = `Search: ${search.value || 'All'} · Status: ${statusFilter.value || 'All'} · Verification: ${verificationFilter.value || 'All'}`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>TickSecure — ${title}</title><style>
        body{font:12px Arial,sans-serif;color:#243032;margin:24px}h1{font-size:24px}table{border-collapse:collapse;width:100%}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{background:#f4f1e9}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm}
        </style></head><body><h1>TickSecure · ${title}</h1><p>${esc(filters)}</p><p>${users.length} accounts · ${esc(new Date().toLocaleString())}</p><table><thead><tr>${reportHeadings.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${users.map(user => `<tr>${reportRow(user).map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">No matching accounts</td></tr>'}</tbody></table></body></html>`;
    frame.addEventListener('load', () => {
        frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
        frame.contentWindow.focus(); frame.contentWindow.print();
    }, { once: true });
    document.body.append(frame);
});

window.addEventListener('ts-auth-ready', event => {
    if (event.detail?.role === 'admin') return loadUsers();
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', $listTitle, $isOrganizerList ? 'organizer-list' : 'users', $content, '..', '');
?>
