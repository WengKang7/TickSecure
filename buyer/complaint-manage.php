<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
require __DIR__ . '/../shared/complaint-manage.php';
$content = ob_get_clean();
render_public_page('Manage Complaint', 'tickets', $content, '..', true);
