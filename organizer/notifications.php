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
const esc = s => (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;');
window.addEventListener('ts-auth-ready', async () => {
    try {
        const notifs = await window.tsNotifications.getForUser();
        const list = document.getElementById('notifs-list');
        
        const renderList = () => {
            if(list) {
                list.innerHTML = notifs.map(n => `
                    <div class="ts-list-item" style="${n.read ? 'opacity:0.6' : ''}">
                        <div class="flex gap-12">
                            <span class="ts-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span>
                            <div>
                                <div class="ts-list-title">${esc(n.title)}</div>
                                <div class="ts-list-sub">${esc(n.message)}</div>
                            </div>
                        </div>
                        ${!n.read ? `<button class="ts-btn ts-btn-secondary ts-btn-sm" data-mark-read="${n.id}">Mark Read</button>` : `<span class="small muted">Read</span>`}
                    </div>
                `).join('') || '<div class="text-center p-20">No notifications</div>';

                list.querySelectorAll('[data-mark-read]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-mark-read');
                        await window.tsNotifications.markRead(id);
                        const n = notifs.find(x => x.id === id);
                        if(n) n.read = true;
                        renderList();
                    });
                });
            }
        };
        
        renderList();

        document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
            await window.tsNotifications.markAllRead();
            notifs.forEach(n => n.read = true);
            renderList();
        });

    } catch(e) { console.error('Failed to load notifications', e); }
});
</script>

<?php
$content = ob_get_clean();
render_dashboard_page('organizer', 'Notifications', 'notifications', $content, '..', '');
?>