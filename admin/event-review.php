<?php
require_once __DIR__ . '/../shared/ui.php';
ob_start();
?>

<?=ts_page_head('Loading...', ' ', '<div id="action-buttons" style="display:none;"><button id="btn-suspend" class="ts-btn ts-btn-secondary">Suspend</button> <button id="btn-reject" class="ts-btn ts-btn-danger">Reject</button> <button id="btn-approve" class="ts-btn ts-btn-success">Approve</button></div>')?>
<div id="event-detail-container" style="display:none;">
    <div>
        <div class="ts-card ts-card-pad">
            <div class="ts-section-eyebrow">Buyer preview</div>
            <div class="ts-event-hero-detail" style="grid-template-columns:260px 1fr;gap:28px">
                <div class="ts-poster" style="min-height:320px">
                    <img id="val-poster" style="width:100%;height:100%;object-fit:cover;" src="" alt="" onerror="this.style.display='none'">
                    <div class="ts-poster-copy">
                        <div class="ts-poster-kicker" id="poster-org"></div>
                        <div class="ts-poster-title" id="poster-title"></div>
                    </div>
                </div>
                <div>
                    <h2 class="mt-0" id="val-title"></h2>
                    <p class="secondary" id="val-subtitle"></p>
                    <p class="secondary" id="val-desc"></p>
                    <div class="flex gap-8 wrap mt-16" id="val-badges"></div>
                </div>
            </div>
        </div>
        <div class="ts-card mt-20">
            <div class="ts-card-head">
                <div>
                    <div class="ts-card-title">Ticket Categories</div>
                    <div class="ts-card-sub">Mapped to Administrator-managed venue sections</div>
                </div>
            </div>
            <div class="ts-table-wrap">
                <table class="ts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Price</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody id="ticket-table-body">
                        <tr><td colspan="4" class="text-center secondary">No categories</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <aside>
        <div class="ts-card ts-card-pad">
            <div class="ts-card-title">Submission Summary</div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Organizer</div>
                <div class="ts-detail-value" id="val-org-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Venue Layout</div>
                <div class="ts-detail-value" id="val-venue-name"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Sales Period</div>
                <div class="ts-detail-value" id="val-sales"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Max / Buyer</div>
                <div class="ts-detail-value" id="val-max-tickets"></div>
            </div>
            <div class="ts-detail-item">
                <div class="ts-detail-label">Resale</div>
                <div class="ts-detail-value" id="val-resale"></div>
            </div>
        </div>
        <div class="ts-alert ts-alert-warning mt-20">
            <?=ts_icon('alert')?>
            <div><strong>Review note</strong>
                <div class="small mt-8">Event approval controls whether the event becomes visible and purchasable by
                    Buyers.</div>
            </div>
        </div>
    </aside>
</div>

<script type="module">

const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


window.addEventListener('ts-auth-ready', async () => {

    const urlParams =
        new URLSearchParams(window.location.search);

    const eventId =
        urlParams.get('id');


    // =========================================================
    // EVENT ID CHECK
    // =========================================================

    if (!eventId) {

        document.querySelector(
            '.ts-page-title'
        ).textContent = 'Event not found';

        document.querySelector(
            '.ts-page-subtitle'
        ).textContent =
            'No event was selected for review.';

        return;
    }


    // =========================================================
    // LOAD EVENT
    // =========================================================

    const loadEvent = async () => {

        try {

            const ev =
                await window.tsEvents.getEvent(
                    eventId
                );


            if (!ev) {
                throw new Error(
                    'Event not found.'
                );
            }


            // -----------------------------------------
            // Main container
            // -----------------------------------------

            const container =
                document.getElementById(
                    'event-detail-container'
                );

            if (container) {
                container.style.display = 'grid';
            }


            // -----------------------------------------
            // Page title
            // -----------------------------------------

            document.querySelector(
                '.ts-page-title'
            ).textContent =
                ev.name || 'Event Review';


            document.querySelector(
                '.ts-page-subtitle'
            ).textContent =
                `Submitted by ${
                    ev.organizerName ||
                    ev.organizerUid ||
                    'Unknown organizer'
                }`;


            // =================================================
            // POSTER
            // =================================================

            const posterImg =
                document.getElementById(
                    'val-poster'
                );

            const posterCopy =
                document.querySelector(
                    '.ts-poster-copy'
                );


            if (ev.posterUrl) {

                posterImg.src =
                    ev.posterUrl;

                posterImg.style.display =
                    'block';

                if (posterCopy) {
                    posterCopy.style.display =
                        'none';
                }

            } else {

                posterImg.style.display =
                    'none';

                if (posterCopy) {
                    posterCopy.style.display =
                        '';
                }

                document.getElementById(
                    'poster-org'
                ).textContent =
                    ev.organizerName ||
                    'Organizer';


                document.getElementById(
                    'poster-title'
                ).textContent =
                    ev.name ||
                    'Event';
            }


            // =================================================
            // EVENT DETAILS
            // =================================================

            document.getElementById(
                'val-title'
            ).textContent =
                ev.name ||
                'Untitled Event';


            const eventDate =
                ev.date
                    ? new Date(
                        `${ev.date}T00:00:00`
                    ).toLocaleDateString()
                    : 'No date';


            document.getElementById(
                'val-subtitle'
            ).textContent =
                `${eventDate} · ${
                    ev.venueName ||
                    ev.venueId ||
                    'No venue'
                }`;


            document.getElementById(
                'val-desc'
            ).textContent =
                ev.description ||
                'No description provided.';


            // =================================================
            // STATUS BADGES
            // =================================================

            const statusStr =
                String(
                    ev.status || 'DRAFT'
                ).toUpperCase();


            const toneMap = {

                PUBLISHED: 'success',

                APPROVED: 'info',

                REJECTED: 'error',

                SUSPENDED: 'warning',

                CANCELLED: 'error',

                DRAFT: 'neutral',

                PENDING_REVIEW: 'warning'

            };


            const tone =
                toneMap[statusStr] ||
                'neutral';


            let badges = `
                <span class="ts-chip ts-chip-${tone}">
                    ${esc(
                        statusStr.replaceAll(
                            '_',
                            ' '
                        )
                    )}
                </span>
            `;


            if (ev.eventCategory) {

                badges += `
                    <span class="ts-chip ts-chip-neutral">
                        ${esc(ev.eventCategory)}
                    </span>
                `;

            }


            document.getElementById(
                'val-badges'
            ).innerHTML =
                badges;


            // =================================================
            // TICKET CATEGORIES
            // =================================================

            const categories =
                Array.isArray(ev.categories)

                    ? ev.categories

                    : Object.entries(
                        ev.categories || {}
                    ).map(
                        ([sectionId, category]) => ({
                            ...category,
                            sectionId
                        })
                    );


            const ticketBody =
                document.getElementById(
                    'ticket-table-body'
                );


            if (categories.length > 0) {

                ticketBody.innerHTML =
                    categories.map(
                        category => `

                            <tr>

                                <td>
                                    ${esc(
                                        category.name ||
                                        'Unnamed'
                                    )}
                                </td>

                                <td>
                                    ${esc(
                                        category.sectionId ||
                                        ''
                                    )}
                                </td>

                                <td>
                                    RM${Number(
                                        category.price || 0
                                    ).toFixed(2)}
                                </td>

                                <td>
                                    ${Number(
                                        category.quantity || 0
                                    )}
                                </td>

                            </tr>

                        `
                    ).join('');

            } else {

                ticketBody.innerHTML = `
                    <tr>
                        <td
                            colspan="4"
                            class="text-center secondary"
                        >
                            No ticket categories configured.
                        </td>
                    </tr>
                `;

            }


            // =================================================
            // SUBMISSION SUMMARY
            // =================================================

            document.getElementById(
                'val-org-name'
            ).textContent =
                ev.organizerName ||
                ev.organizerUid ||
                'Unknown';


            document.getElementById(
                'val-venue-name'
            ).textContent =
                ev.venueName ||
                ev.venueId ||
                'Not configured';


            // Sales period

            let salesPeriod =
                'Not configured';


            if (
                ev.salesStartDate &&
                ev.salesEndDate
            ) {

                salesPeriod =
                    `${new Date(
                        ev.salesStartDate
                    ).toLocaleString()}
                    -
                    ${new Date(
                        ev.salesEndDate
                    ).toLocaleString()}`;

            }


            document.getElementById(
                'val-sales'
            ).textContent =
                salesPeriod;


            // Maximum tickets per buyer

            document.getElementById(
                'val-max-tickets'
            ).textContent =
                ev.maxTicketsPerBuyer

                    ? `${ev.maxTicketsPerBuyer} tickets`

                    : 'Not configured';


            // Resale settings

            let resaleText =
                'Not configured';


            if (
                ev.resaleEnabled !==
                undefined
            ) {

                if (ev.resaleEnabled) {

                    resaleText =
                        `Enabled · Max ${
                            Number(
                                ev.maxResaleMarkup || 0
                            )
                        }% markup`;

                } else {

                    resaleText =
                        'Disabled';

                }

            }


            document.getElementById(
                'val-resale'
            ).textContent =
                resaleText;


            // =================================================
            // ACTION BUTTONS
            // =================================================

            const btnGroup =
                document.getElementById(
                    'action-buttons'
                );

            const btnApprove =
                document.getElementById(
                    'btn-approve'
                );

            const btnReject =
                document.getElementById(
                    'btn-reject'
                );

            const btnSuspend =
                document.getElementById(
                    'btn-suspend'
                );


            if (
                statusStr ===
                'PENDING_REVIEW'
            ) {

                btnGroup.style.display =
                    'flex';

                btnApprove.style.display =
                    'inline-flex';

                btnReject.style.display =
                    'inline-flex';

                btnSuspend.style.display =
                    'none';

            }

            else if (
                statusStr ===
                    'PUBLISHED'
                ||
                statusStr ===
                    'APPROVED'
            ) {

                btnGroup.style.display =
                    'flex';

                btnApprove.style.display =
                    'none';

                btnReject.style.display =
                    'none';

                btnSuspend.style.display =
                    'inline-flex';

            }

            else {

                btnGroup.style.display =
                    'none';

            }


            // =================================================
            // APPROVE
            // =================================================

            btnApprove.onclick =
                async () => {

                    if (
                        !confirm(
                            'Approve and publish this event?'
                        )
                    ) {
                        return;
                    }


                    btnApprove.disabled =
                        true;

                    btnApprove.textContent =
                        'Approving...';


                    try {

                        await window.tsEvents
                            .approveEvent(
                                eventId
                            );

                        await loadEvent();

                    } catch (error) {

                        console.error(
                            'Approve event error:',
                            error
                        );

                        alert(
                            error?.message ||
                            'Unable to approve event.'
                        );

                    } finally {

                        btnApprove.disabled =
                            false;

                        btnApprove.textContent =
                            'Approve';

                    }

                };


            // =================================================
            // REJECT
            // =================================================

            btnReject.onclick =
                async () => {

                    const reason =
                        prompt(
                            'Reason for rejection:'
                        );


                    if (!reason?.trim()) {
                        return;
                    }


                    btnReject.disabled =
                        true;


                    try {

                        await window.tsEvents
                            .rejectEvent(
                                eventId,
                                reason.trim()
                            );

                        await loadEvent();

                    } catch (error) {

                        console.error(
                            'Reject event error:',
                            error
                        );

                        alert(
                            error?.message ||
                            'Unable to reject event.'
                        );

                    } finally {

                        btnReject.disabled =
                            false;

                    }

                };


            // =================================================
            // SUSPEND
            // =================================================

            btnSuspend.onclick =
                async () => {

                    const reason =
                        prompt(
                            'Reason for suspension:'
                        );


                    if (!reason?.trim()) {
                        return;
                    }


                    btnSuspend.disabled =
                        true;


                    try {

                        await window.tsEvents
                            .suspendEvent(
                                eventId,
                                reason.trim()
                            );

                        await loadEvent();

                    } catch (error) {

                        console.error(
                            'Suspend event error:',
                            error
                        );

                        alert(
                            error?.message ||
                            'Unable to suspend event.'
                        );

                    } finally {

                        btnSuspend.disabled =
                            false;

                    }

                };


        } catch (err) {

            console.error(
                'Event review load error:',
                err
            );


            document.querySelector(
                '.ts-page-title'
            ).textContent =
                'Error loading event';


            document.querySelector(
                '.ts-page-subtitle'
            ).textContent =
                err?.message ||
                'Unable to load event information.';


            document.getElementById(
                'event-detail-container'
            ).style.display =
                'none';

        }

    };


    await loadEvent();

});

</script>

<?php
$content = ob_get_clean();
render_dashboard_page('admin', 'Review Event', 'events', $content, '..', '');
?>