const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const asAmount = value => {
    const amount = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
};

const findCategory = (rawCategories, sectionId, sectionIdsByName = new Map()) => {
    const entries = Array.isArray(rawCategories)
        ? rawCategories.map((category, index) => [
            category?.sectionId ?? category?.id ?? category?.section ?? String(index),
            category
        ])
        : Object.entries(rawCategories || {});

    return entries.map(([key, category]) => {
        const legacySection = String(category?.sectionId ?? category?.id ?? category?.section ?? key ?? '').trim();
        const canonicalSectionId = sectionIdsByName.get(legacySection.toLowerCase()) || legacySection;
        return {
            sectionId: canonicalSectionId,
            name: String(category?.name ?? category?.categoryName ?? canonicalSectionId).trim() || canonicalSectionId,
            quantity: Math.max(0, Math.floor(asAmount(category?.quantity ?? category?.available)))
        };
    }).find(category => category.sectionId === sectionId) || null;
};

const reservationStorageKey = (eventId, sectionId, quantity) =>
    `ts-seat-reservation:${window.tsCurrentUser?.uid}:${eventId}:${sectionId}:${quantity}`;

let initialized = false;
let reservationTimer;
let currentReservation;
let currentStorageKey;
const initializeSeatAssignment = async () => {
    if (initialized) return;
    initialized = true;
    clearInterval(reservationTimer);
    document.getElementById('retry-reservation').hidden = true;
    document.getElementById('assignment-title').textContent = 'Assigning your seats';
    document.getElementById('assignment-state').textContent = 'Seat assignment';
    document.getElementById('assigned-seat-alert').className = 'ts-alert ts-alert-info mt-24';

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = String(urlParams.get('eventId') || '').trim();
    const sectionId = String(urlParams.get('sectionId') || '').trim();
    const requestedQuantity = Math.max(1, parseInt(urlParams.get('qty'), 10) || 1);
    const selectionParams = new URLSearchParams({ id: eventId, sectionId, qty: String(requestedQuantity) });
    document.getElementById('change-category-btn').href = eventId
        ? `../public/event-detail.php?${selectionParams}` : '../public/events.php';
    const assignedText = document.getElementById('assigned-seat-text');
    const assignedSubtext = document.getElementById('assigned-seat-sub');
    const seatContainer = document.getElementById('seat-pills-container');
    const reservationBar = document.getElementById('reservation-bar');
    const countdown = document.getElementById('countdown-timer');
    const continueButton = document.getElementById('btn-continue');

    const disableContinue = label => {
        continueButton.textContent = label;
        continueButton.removeAttribute('href');
        continueButton.setAttribute('aria-disabled', 'true');
        continueButton.style.pointerEvents = 'none';
        continueButton.style.opacity = '0.55';
    };
    const enableContinue = (label, href) => {
        continueButton.textContent = label;
        continueButton.href = href;
        continueButton.removeAttribute('aria-disabled');
        continueButton.style.pointerEvents = '';
        continueButton.style.opacity = '';
    };

    if (!eventId || !sectionId) {
        assignedText.textContent = 'Choose a ticket category first';
        assignedSubtext.textContent = 'Return to category selection to reserve seats.';
        disableContinue('Choose a Category');
        return;
    }

    try {
        disableContinue('Assigning Seats…');
        const event = await window.tsEvents.getEvent(eventId);
        if (!event?.venueId) throw new Error('The event venue is unavailable.');

        const venue = await window.tsVenues.getVenue(event.venueId);
        const sectionIdsByName = new Map();
        (venue?.sections || []).forEach(section => {
            const physicalSectionId = String(section.sectionId ?? '').trim();
            if (!physicalSectionId) return;
            sectionIdsByName.set(physicalSectionId.toLowerCase(), physicalSectionId);
            sectionIdsByName.set(String(section.name ?? '').trim().toLowerCase(), physicalSectionId);
        });

        const category = findCategory(event.categories, sectionId, sectionIdsByName);
        if (!category) throw new Error('The selected ticket category is no longer available.');
        const maxPerBuyer = Math.max(1, parseInt(event.maxTicketsPerBuyer, 10) || 4);
        const quantity = requestedQuantity;
        if (quantity < 1 || quantity > Math.min(maxPerBuyer, category.quantity)) throw new Error('The selected quantity is no longer available. Change your category or quantity and try again.');

        const storageKey = reservationStorageKey(eventId, sectionId, quantity);
        let reservation;
        {
            const allocated = await window.tsSeats.reserveNextAvailableSeats({
                eventId,
                venueId: event.venueId,
                sectionId,
                count: quantity,
                expiryMinutes: 10
            });
            reservation = {
                seatDocIds: allocated.seats.map(seat => seat.id),
                seatLabels: allocated.seats.map(seat => seat.seatLabel),
                reservationExpiry: allocated.reservationExpiry,
                reservationId: allocated.reservationId || ''
            };
            try { sessionStorage.setItem(storageKey, JSON.stringify(reservation)); } catch (_) { /* URL carries the reservation too. */ }
        }
        currentReservation = { ...reservation, eventId };
        currentStorageKey = storageKey;
        document.getElementById('assignment-title').textContent = 'Your seats are reserved';
        document.getElementById('assignment-state').textContent = 'Assignment completed';
        document.getElementById('assigned-seat-alert').className = 'ts-alert ts-alert-success mt-24';
        document.getElementById('assignment-icon').textContent = '\u2713';

        assignedText.textContent = `${category.name} · Seats: ${reservation.seatLabels.join(', ')}`;
        assignedSubtext.textContent = 'These seats are reserved while you complete checkout.';
        seatContainer.innerHTML = reservation.seatLabels
            .map(label => `<span class="ts-seat-pill next">${escapeHtml(label)}</span>`)
            .join('');

        const checkoutParams = new URLSearchParams({
            eventId,
            sectionId,
            qty: String(reservation.seatDocIds.length),
            seatIds: reservation.seatDocIds.join(','),
            seatLabels: reservation.seatLabels.join(','),
            reservationExpiry: reservation.reservationExpiry
        });
        if (reservation.reservationId) checkoutParams.set('reservationId', reservation.reservationId);
        const checkoutUrl = `checkout.php?${checkoutParams.toString()}`;

        const profile = window.tsCurrentUser || {};
        const walletName = document.getElementById('wallet-name');
        const walletStatus = document.getElementById('wallet-status');
        const walletChip = document.getElementById('wallet-chip');
        if (/^0x[a-fA-F0-9]{40}$/.test(profile.walletAddress || '')) {
            walletName.textContent = 'Wallet Connected';
            walletStatus.textContent = profile.walletAddress;
            walletChip.className = 'ts-chip ts-chip-success';
            walletChip.textContent = 'Ready';
            enableContinue('Continue to Payment', checkoutUrl);
        } else {
            walletName.textContent = 'Wallet Required';
            walletStatus.textContent = 'Connect a wallet to continue checkout.';
            walletChip.className = 'ts-chip ts-chip-warning';
            walletChip.textContent = 'Required';
            enableContinue('Continue to Wallet', `wallet.php?redirect=${encodeURIComponent(checkoutUrl)}`);
        }

        reservationBar.style.display = 'flex';
        let released = false;
        const expireReservation = async () => {
            if (released) return;
            released = true;
            sessionStorage.removeItem(storageKey);
            disableContinue('Reservation Expired');
            document.getElementById('assignment-title').textContent = 'Reservation expired';
            document.getElementById('assigned-seat-alert').className = 'ts-alert ts-alert-error mt-24';
            assignedSubtext.textContent = 'Your reserved seats were released. Choose a category to try again.';
            try {
                await window.tsSeats.releaseSeats(reservation.seatDocIds, { eventId });
            } catch (error) {
                console.warn('Could not release the expired reservation:', error);
            }
        };
        const updateCountdown = () => {
            const remainingSeconds = Math.max(0, Math.ceil((Date.parse(reservation.reservationExpiry) - Date.now()) / 1000));
            countdown.textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
            if (remainingSeconds <= 0) {
                clearInterval(timer);
                expireReservation();
            }
        };
        const timer = reservationTimer = setInterval(updateCountdown, 1000);
        updateCountdown();
    } catch (error) {
        console.error('Seat assignment failed:', error);
        assignedText.textContent = 'Seats could not be reserved';
        document.getElementById('assignment-title').textContent = 'Reservation unsuccessful';
        document.getElementById('assignment-state').textContent = 'Please try again';
        document.getElementById('assigned-seat-alert').className = 'ts-alert ts-alert-error mt-24';
        document.getElementById('assignment-icon').textContent = '!';
        document.getElementById('retry-reservation').hidden = false;
        assignedSubtext.textContent = error.message || 'Please return to category selection and try again.';
        seatContainer.innerHTML = '';
        reservationBar.style.display = 'none';
        disableContinue('Choose a Category');
    }
};

document.getElementById('retry-reservation').addEventListener('click', () => {
    initialized = false;
    initializeSeatAssignment();
});
document.getElementById('change-category-btn').addEventListener('click', async event => {
    if (!currentReservation) return;
    event.preventDefault();
    const button = document.getElementById('change-category-btn');
    button.setAttribute('aria-disabled', 'true');
    try {
        await window.tsSeats.releaseSeats(currentReservation.seatDocIds, { eventId: currentReservation.eventId });
        try { sessionStorage.removeItem(currentStorageKey); } catch (_) {}
        clearInterval(reservationTimer);
        window.location.href = button.href;
    } catch (error) {
        document.getElementById('assigned-seat-sub').textContent = error.message || 'Could not release your seats. Please try again.';
    } finally { button.removeAttribute('aria-disabled'); }
});

window.addEventListener('ts-auth-ready', event => {
    if (event.detail) return initializeSeatAssignment();
});
if (window.tsCurrentUser) initializeSeatAssignment();
