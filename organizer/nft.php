<?php
// Keep existing bookmarks and dashboard links pointed at the moved NFT subtab.
header('Location: blockchain.php?tab=nft', true, 302);
exit;
