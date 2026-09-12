<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Notifications', 'Event approval, ticket issuance, secondary-market and system updates for your organization.', '<button class="ts-btn ts-btn-secondary" id="mark-all-read-btn">Mark all as read</button>')?>
<div class="ts-card ts-card-pad">
    <div class="ts-list" id="notifs-list">
        <div class="text-center p-20">Loading...</div>
    </div>
</div>

<script type="module">
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const notificationTitle = type => String(type || 'notification')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

const dateTime = value => {
    if (!value) return 'Just now';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const relatedLink = notification => {
    const id = String(notification.relatedEntityId || '').trim();
    if (!id) return '';

    const type = String(notification.relatedEntityType || '').toLowerCase();
    const hrefByType = {
        event: `event-detail.php?id=${encodeURIComponent(id)}`,
        booking: 'sales.php',
        ticket: 'nft.php',
        resale: 'secondary-market.php',
        complaint: 'complaints.php'
    };
    const href = hrefByType[type];
    return href ? `<a class="ts-btn ts-btn-secondary ts-btn-sm" href="${href}">View</a>` : '';
};

window.addEventListener('ts-auth-ready', async () => {
    try {
        const notifs = await window.tsNotifications.getForUser();
        const list = document.getElementById('notifs-list');
        const markAllButton = document.getElementById('mark-all-read-btn');
        if (!list) return;
        
        const renderList = () => {
            list.innerHTML = notifs.map(n => {
                const read = Boolean(n.read ?? n.isRead);
                const notificationId = encodeURIComponent(n.id);
                return `
                    <div class="ts-list-item" style="${read ? 'opacity:0.6' : ''}">
                        <div class="flex gap-12">
                            <span class="ts-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span>
                            <div>
                                <div class="ts-list-title">${esc(notificationTitle(n.type))}</div>
                                <div class="ts-list-sub">${esc(n.message)}</div>
                                <div class="small muted mt-8">${esc(dateTime(n.createdAt))}</div>
                            </div>
                        </div>
                        <div class="ts-table-actions">
                            ${relatedLink(n)}
                            ${!read ? `<button class="ts-btn ts-btn-secondary ts-btn-sm" type="button" data-mark-read="${notificationId}">Mark read</button>` : `<span class="small muted">Read</span>`}
                        </div>
                    </div>
                `;
            }).join('') || '<div class="text-center p-20">No notifications</div>';

            if (markAllButton) {
                markAllButton.disabled = !notifs.some(n => !Boolean(n.read ?? n.isRead));
            }
            list.querySelectorAll('[data-mark-read]').forEach(button => {
                button.addEventListener('click', async () => {
                    const id = decodeURIComponent(button.dataset.markRead || '');
                    button.disabled = true;
                    try {
                        await window.tsNotifications.markRead(id);
                        const notification = notifs.find(item => item.id === id);
                        if (notification) {
                            notification.read = true;
                            notification.isRead = true;
                        }
                        renderList();
                    } catch (error) {
                        console.error('Unable to mark notification as read:', error);
                        window.alert(error?.message || 'The notification could not be updated.');
                        button.disabled = false;
                    }
                });
            });
        };
        
        renderList();

        markAllButton?.addEventListener('click', async () => {
            markAllButton.disabled = true;
            try {
                await window.tsNotifications.markAllRead();
                notifs.forEach(notification => {
                    notification.read = true;
                    notification.isRead = true;
                });
                renderList();
            } catch (error) {
                console.error('Unable to mark notifications as read:', error);
                window.alert(error?.message || 'The notifications could not be updated.');
                markAllButton.disabled = false;
            }
        });

    } catch(e) {
        console.error('Failed to load notifications', e);
        const list = document.getElementById('notifs-list');
        if (list) list.innerHTML = `<div class="text-center p-20 secondary">${esc(e?.message || 'Unable to load notifications.')}</div>`;
    }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Notifications', 'notifications', $content, '..', '');
?>
