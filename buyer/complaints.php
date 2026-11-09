<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>
<main class="ts-section-tight ts-help-page">
  <div class="ts-container">
    <div class="ts-section-title-row"><div><div class="ts-section-eyebrow">A little guidance</div><h1 class="ts-section-title">Help &amp; information.</h1><p class="ts-section-copy">Find your event, choose your seat and get ready for the music.</p></div></div>
    <div class="ts-help-grid">
      <section class="ts-card ts-card-pad"><span class="ts-help-number">01 / BOOKING</span><h2>Find your place.</h2><p>Browse Events, open an event and choose a ticket category and quantity. On Choose seats, use the 2D plan or 3D view to select your seats, then reserve them before continuing to checkout.</p><a class="ts-btn ts-btn-secondary" href="../public/events.php">Explore events <?=ts_icon('arrow-right')?></a></section>
      <section class="ts-card ts-card-pad"><span class="ts-help-number">02 / YOUR TICKETS</span><h2>Keep it all together.</h2><p>Open My Tickets to view your tickets, entry QR codes and ownership details. Open My blockchain from your account menu to track an NFT operation.</p><a class="ts-btn ts-btn-secondary" href="tickets.php">View my tickets <?=ts_icon('arrow-right')?></a></section>
      <section class="ts-card ts-card-pad"><span class="ts-help-number">03 / STAY UPDATED</span><h2>Stay in the know.</h2><p>The notification bell opens your booking, ticket and resale updates. Use Mark read after reviewing a message, or Mark all as read to clear the unread indicator.</p><a class="ts-btn ts-btn-secondary" href="notifications.php">View notifications <?=ts_icon('arrow-right')?></a></section>
    </div>
    <section class="ts-help-faq" aria-labelledby="help-faq-heading">
      <div class="ts-help-faq-heading"><div class="ts-section-eyebrow">Good to know</div><h2 id="help-faq-heading">Before the doors open.</h2><p class="secondary">Quick answers to the questions that come up most.</p></div>
      <div class="ts-help-questions">
        <details class="ts-simple-details"><summary>Do I pay real money for a ticket?</summary><p>This project uses simulated ticket payments for demonstration. The amount shown at checkout is a demo payment record. NFT operations use Sepolia test ETH for network gas, separately from the simulated ticket price.</p></details>
        <details class="ts-simple-details"><summary>Why do I need MetaMask?</summary><p>Your connected wallet identifies the owner of your ticket NFT. Follow the wallet prompts when an NFT operation needs your approval. Make sure you use the wallet saved to your buyer account and the Sepolia network.</p></details>
        <details class="ts-simple-details"><summary>Where can I see the view from my seat?</summary><p>Choose a category on the event page, then continue to Choose seats. Switch to 3D view to rotate and zoom the venue or preview a seat's view. Show people adds an illustrative audience; it does not show actual attendees or live occupancy.</p></details>
        <details class="ts-simple-details"><summary>How long are selected seats reserved?</summary><p>Seats are held for 10 minutes after a successful reservation. Follow the countdown on the booking screen and complete the next steps before it expires. Selecting a seat alone does not reserve it.</p></details>
        <details class="ts-simple-details"><summary>What should I show at the entrance?</summary><p>Open the ticket in My Tickets and present its entry QR code to event staff. Each ticket permits one entry. Keep the QR code private and check the event date, time and venue before travelling.</p></details>
        <details class="ts-simple-details"><summary>Can I transfer or resell my ticket?</summary><p>Transfer and resale depend on the organizer's event rules and your ticket's current status. Open a ticket to check the permitted actions. If resale is allowed, use the official Resale market and complete any required wallet approval.</p></details>
        <details class="ts-simple-details"><summary>My ticket NFT is pending. What should I do?</summary><p>Check your NFT transactions from the account menu or ticket details. Review any pending wallet request and make sure the submitting wallet has enough Sepolia test ETH for gas. An approved transaction still needs blockchain confirmation before its status updates.</p></details>
      </div>
    </section>
  </div>
</main>
<?php
$content = ob_get_clean();
render_public_page('Help & information', 'help', $content, '..', true);
?>
