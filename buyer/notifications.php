<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main class="ts-section-tight">
    <div class="ts-container" style="max-width:1000px">
        <div class="ts-section-title-row">
            <div>
                <div class="ts-section-eyebrow">Updates</div>
                <h1 class="ts-section-title">Notifications</h1>
                <p class="ts-section-copy">Booking, ticket, event, transfer, resale and complaint updates.</p>
            </div><button class="ts-btn ts-btn-secondary" id="btn-mark-all">Mark All as
                Read</button>
        </div>
        <div class="ts-card ts-card-pad" id="notif-container">
            <p class="secondary">Loading...</p>
        </div>
    </div>
</main>

<script type="module">
window.addEventListener('ts-auth-ready', async () => {
    const container = document.getElementById('notif-container');
    const btnMarkAll = document.getElementById('btn-mark-all');

    const loadData = async () => {
        try {
            const notifs = await window.tsNotifications.getForUser();
            if (notifs.length === 0) {
                container.innerHTML = '<p class="secondary">No notifications found.</p>';
                return;
            }

            container.innerHTML = notifs.map(n => \`
                <div class="ts-list-item \${!n.isRead ? 'unread' : ''}">
                    <div class="flex gap-12">
                        <div>
                            <div class="ts-list-title">\${n.title}</div>
                            <div class="ts-list-sub">\${n.message}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-12">
                        <span class="small muted">\${n.createdAt ? (typeof n.createdAt.toDate === 'function' ? n.createdAt.toDate().toLocaleString() : n.createdAt) : ''}</span>
                        \${!n.isRead ? \`<button class="ts-btn ts-btn-secondary ts-btn-sm btn-read" data-id="\${n.id}">Mark Read</button>\` : ''}
                    </div>
                </div>
            \`).join('');

            container.querySelectorAll('.btn-read').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    try {
                        await window.tsNotifications.markRead(id);
                        await loadData();
                    } catch (err) {
                        console.error('Mark read error:', err);
                    }
                });
            });

        } catch (err) {
            console.error('Load error:', err);
        }
    };

    btnMarkAll.addEventListener('click', async () => {
        try {
            await window.tsNotifications.markAllRead();
            await loadData();
        } catch (err) {
            console.error('Mark all read error:', err);
        }
    });

    loadData();
});
</script>

<?php
$content = ob_get_clean();
render_public_page('Notifications', 'tickets', $content, '..', true);
?>