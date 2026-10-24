<?php
// Keep old preview bookmarks and local Firebase configuration links working.
$query = $_SERVER['QUERY_STRING'] ?? '';
header('Location: index.php' . ($query !== '' ? '?' . $query : ''), true, 302);
exit;
