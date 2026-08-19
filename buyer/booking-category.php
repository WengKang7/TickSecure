<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?php

$eventVenueId = 'merdeka-hall';

$eventCategoryMap = [

    'A' => [
        'name' => 'VIP1',
        'price' => 'RM688'
    ],

    'B' => [
        'name' => 'VIP2',
        'price' => 'RM488'
    ],

    'C' => [
        'name' => 'CAT1',
        'price' => 'RM288'
    ]

];

?>

<main class="ts-section-tight">
  <div class="ts-container">
          <div class="ts-card ts-card-pad mb-24">

    <div class="ts-card-title">
        Choose Your Ticket Category
    </div>

    <div class="ts-card-sub">
        Use the venue layout to understand where each
        ticket category is located.
    </div>


    <div class="mt-20">

        <?= ts_render_venue_layout(
            $eventVenueId,
            'buyer',
            $eventCategoryMap
        ) ?>

    </div>
    <div class="ts-steps">
      
      <div class="ts-step active"><span class="ts-step-num">1</span>Category</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">2</span>Seat Assignment</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">3</span>Wallet</div><span class="ts-step-line"></span>
      <div class="ts-step"><span class="ts-step-num">4</span>Payment</div>
    </div>
    <div class="ts-content-grid">
      <div>
        <div class="ts-section-eyebrow">Aurora After Dark</div>
        <h1 class="ts-section-title">Choose your ticket category</h1>
        <p class="ts-section-copy mb-24">Select a category and quantity. TickSecure will automatically assign the next
          available seats in the mapped venue section.</p>
        <div class="ts-category-list">
          <div class="ts-card ts-card-pad mb-24">

    <div class="ts-card-title">
        Venue Layout
    </div>

    <div class="ts-card-sub">
        Merdeka Hall · Choose a category based on its location.
    </div>


    <div class="ts-mini-venue-layout mt-16">

        <div class="ts-mini-stage">
            STAGE
        </div>

        <div class="ts-mini-section mini-a">

            <strong>VIP1</strong>
            <span>Section A</span>
            <span>RM688</span>

        </div>

        <div class="ts-mini-section mini-b">

            <strong>CAT1</strong>
            <span>Section B</span>
            <span>RM488</span>

        </div>

        <div class="ts-mini-section mini-c">

            <strong>CAT2</strong>
            <span>Section C</span>
            <span>RM288</span>

        </div>

    </div>

</div>
          <div class="ts-category-card selected" data-select-card>
            <div>
              <div class="ts-category-name">VIP1</div>
              <div class="ts-category-meta">Section A · 18 remaining · auto-assigned seating</div>
            </div>
            <div class="flex items-center gap-16">
              <div class="ts-category-price">RM688</div>
              <div class="flex items-center gap-8" data-qty data-min="1" data-max="4"><button class="ts-icon-btn"
                  data-qty-minus>−</button><strong data-qty-value>1</strong><button class="ts-icon-btn"
                  data-qty-plus>+</button></div>
            </div>
          </div>
          <div class="ts-category-card" data-select-card>
            <div>
              <div class="ts-category-name">CAT1</div>
              <div class="ts-category-meta">Section B · 42 remaining · auto-assigned seating</div>
            </div>
            <div class="flex items-center gap-16">
              <div class="ts-category-price">RM488</div>
              <div class="flex items-center gap-8" data-qty><button class="ts-icon-btn" data-qty-minus>−</button><strong
                  data-qty-value>1</strong><button class="ts-icon-btn" data-qty-plus>+</button></div>
            </div>
          </div>
          <div class="ts-category-card" data-select-card>
            <div>
              <div class="ts-category-name">CAT2</div>
              <div class="ts-category-meta">Section C · 9 remaining · auto-assigned seating</div>
            </div>
            <div class="flex items-center gap-16">
              <div class="ts-category-price">RM288</div>
              <div class="flex items-center gap-8" data-qty><button class="ts-icon-btn" data-qty-minus>−</button><strong
                  data-qty-value>1</strong><button class="ts-icon-btn" data-qty-plus>+</button></div>
            </div>
          </div>
        </div>
        <div class="ts-note mt-20">
          <?=ts_icon('shield')?>
          <div><strong>Automatic seat assignment</strong>
            <div class="small mt-8">Seats are assigned by the next available assignment order within the selected
              category. You will see the assigned seat numbers before payment.</div>
          </div>
        </div>
      </div>
      <aside>
        <div class="ts-card ts-card-pad ts-order-summary">
          <div class="ts-card-title">Order summary</div>
          <div class="ts-summary-row"><span>VIP1 × 1</span><strong>RM688.00</strong></div>
          <div class="ts-summary-row"><span>Service charge</span><strong>RM20.00</strong></div>
          <div class="ts-summary-row total"><span>Total</span><span>RM708.00</span></div><a
            class="ts-btn ts-btn-primary w-full mt-16" href="seat-assignment.php">Continue</a>
          <p class="small muted text-center">Maximum 4 tickets per buyer.</p>
        </div>
      </aside>
    </div>
  </div>
</main>

<?php
$content = ob_get_clean();
render_public_page('Select Ticket Category', 'events', $content, '..', true);
?>