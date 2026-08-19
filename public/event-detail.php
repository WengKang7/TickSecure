<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<main>
  <section class="ts-section-tight">
    <div class="ts-container ts-event-hero-detail">
      <div class="ts-poster">
        <div class="ts-poster-copy">
          <div class="ts-poster-kicker">TickSecure Presents</div>
          <div class="ts-poster-title">Aurora<br>After Dark</div>
        </div>
      </div>
      <div class="ts-event-info">
        <div class="ts-section-eyebrow">Live Concert</div>
        <h1>Aurora After Dark</h1>
        <p class="secondary">An immersive live performance presented by Nova Stage Entertainment, with verified tickets
          and automatically assigned seating.</p>
        <div class="ts-info-list">
          <div class="ts-info-pill">
            <?=ts_icon('calendar')?>
            <div><strong>18 October 2026</strong><span>8:00 PM</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('map-pin')?>
            <div><strong>Merdeka Hall</strong><span>Kuala Lumpur</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('building')?>
            <div><strong>Nova Stage Entertainment</strong><span>Approved organizer</span></div>
          </div>
          <div class="ts-info-pill">
            <?=ts_icon('ticket')?>
            <div><strong>From RM288</strong><span>Tickets available</span></div>
          </div>
        </div>
        <div class="flex gap-12 wrap"><a class="ts-btn ts-btn-primary ts-btn-lg"
            href="../buyer/booking-category.php">Book Tickets</a><button class="ts-btn ts-btn-secondary ts-btn-lg"
            data-toast="Event saved to your favourites">Save Event</button></div>
      </div>
    </div>
  </section>
  <section class="ts-section-tight">
    <div class="ts-container" data-tabs>
      <div class="ts-tabs"><button class="ts-tab active" data-tab="overview">Overview</button><button class="ts-tab"
          data-tab="venue">Venue</button><button class="ts-tab" data-tab="tickets">Ticket Categories</button><button
          class="ts-tab" data-tab="policies">Policies</button></div>
      <div class="ts-tab-panel active" data-panel="overview">
        <div class="ts-grid-2">
          <div>
            <h3>About the event</h3>
            <p class="secondary">A premium evening production with curated visual design, immersive staging and secure
              digital ticketing. Entry is validated against the current ticket owner and single-use QR status.</p>
          </div>
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Ticketing at a glance</div>
            <div class="ts-list">
              <div class="ts-list-item"><span>Automatic seat
                  assignment</span><?=ts_status('Enabled', 'success')?>
              </div>
              <div class="ts-list-item"><span>Ticket
                  transfer</span><?=ts_status('Allowed', 'info')?>
              </div>
              <div class="ts-list-item"><span>Official
                  resale</span><?=ts_status('Allowed', 'info')?>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
    class="ts-tab-panel"
    data-panel="venue"
>

<div
    class="ts-tab-panel"
    data-panel="venue"
>

    <div class="ts-card ts-card-pad">

        <div class="flex justify-between items-center">

            <div>

                <h3 class="mt-0 mb-4">
                    Merdeka Hall
                </h3>

                <p class="secondary">
                    Jalan Hang Jebat, Kuala Lumpur · Capacity 2,400
                </p>

            </div>

            <?= ts_status('Approved Venue Layout', 'success') ?>

        </div>


        <div class="ts-venue-layout-shell mt-24">

            <div class="ts-venue-layout-board">

                <div class="ts-venue-layout-stage">
                    STAGE
                </div>


                <div
                    class="ts-venue-zone"
                    style="left:8%; top:150px; width:34%; height:145px;"
                >
                    <div class="ts-venue-zone-content">

                        <div class="ts-venue-zone-title">
                            VIP1
                        </div>

                        <div class="ts-venue-zone-sub">
                            Section A
                        </div>

                        <div class="ts-venue-zone-sub">
                            RM688
                        </div>

                    </div>
                </div>


                <div
                    class="ts-venue-zone"
                    style="right:8%; top:150px; width:34%; height:145px;"
                >
                    <div class="ts-venue-zone-content">

                        <div class="ts-venue-zone-title">
                            VIP2
                        </div>

                        <div class="ts-venue-zone-sub">
                            Section B
                        </div>

                        <div class="ts-venue-zone-sub">
                            RM488
                        </div>

                    </div>
                </div>


                <div
                    class="ts-venue-zone"
                    style="left:18%; right:18%; bottom:52px; height:140px;"
                >
                    <div class="ts-venue-zone-content">

                        <div class="ts-venue-zone-title">
                            CAT1
                        </div>

                        <div class="ts-venue-zone-sub">
                            Section C
                        </div>

                        <div class="ts-venue-zone-sub">
                            RM288
                        </div>

                    </div>
                </div>

            </div>


            <div class="ts-venue-layout-panel">

                <h3>
                    Category Layout
                </h3>

                <p class="small muted">
                    Select a category based on its position.
                    TickSecure will automatically assign the next available seat.
                </p>


                <div class="ts-section-card">

                    <div class="ts-section-card-title">
                        VIP1
                    </div>

                    <div class="small muted">
                        Section A · RM688
                    </div>

                </div>


                <div class="ts-section-card">

                    <div class="ts-section-card-title">
                        VIP2
                    </div>

                    <div class="small muted">
                        Section B · RM488
                    </div>

                </div>


                <div class="ts-section-card">

                    <div class="ts-section-card-title">
                        CAT1
                    </div>

                    <div class="small muted">
                        Section C · RM288
                    </div>

                </div>

            </div>

        </div>


        <div class="ts-note mt-20">

            <?= ts_icon('info') ?>

            <div>

                <strong>
                    Automatic seat assignment
                </strong>

                <div class="small mt-6">
                    Buyers select only the ticket category and quantity.
                    TickSecure assigns the next available seat within the selected section.
                </div>

            </div>

        </div>

    </div>

</div>

</div>
      <div class="ts-tab-panel" data-panel="tickets">
        <div class="ts-category-list">
          <div class="ts-category-card">
            <div>
              <div class="ts-category-name">VIP1</div>
              <div class="ts-category-meta">Section A · 18 remaining · automatic seat assignment</div>
            </div>
            <div class="ts-category-price">
              RM688<br><?=ts_status('Available', 'success')?>
            </div>
          </div>
          <div class="ts-category-card">
            <div>
              <div class="ts-category-name">CAT1</div>
              <div class="ts-category-meta">Section B · 42 remaining · automatic seat assignment</div>
            </div>
            <div class="ts-category-price">
              RM488<br><?=ts_status('Available', 'success')?>
            </div>
          </div>
          <div class="ts-category-card">
            <div>
              <div class="ts-category-name">CAT2</div>
              <div class="ts-category-meta">Section C · 9 remaining · automatic seat assignment</div>
            </div>
            <div class="ts-category-price">
              RM288<br><?=ts_status('Limited', 'warning')?>
            </div>
          </div>
        </div>
      </div>
      <div class="ts-tab-panel" data-panel="policies">
        <div class="ts-grid-2">
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Transfer policy</div>
            <p class="secondary">Eligible tickets may be transferred before the organizer-defined deadline. Wallet
              approval is required.</p>
          </div>
          <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Resale policy</div>
            <p class="secondary">Official resale is enabled. Prices cannot exceed the organizer-defined maximum.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<?php
$content = ob_get_clean();
render_public_page('Aurora After Dark', 'events', $content, '..', true);
?>