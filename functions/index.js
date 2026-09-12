/*
 * Trusted Firebase backend for security-sensitive TickSecure workflows.
 *
 * Firestore rules intentionally reject direct browser writes to tickets,
 * bookings, resale listings, and scans. Firebase Admin bypasses those rules,
 * so every mutation here validates the caller and derives prices/state from
 * trusted Firestore records instead of browser input.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

const db = getFirestore();
const region = 'asia-southeast1';
const serviceCharge = 20;
const maxTicketsPerBuyer = 20;
const maxInventoryPerCategory = 100000;
const maxCurrencyAmount = 1000000;

function now() {
    return new Date().toISOString();
}

function requireAuth(request) {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    return request.auth.uid;
}

function requireDataObject(request) {
    const data = request?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new HttpsError('invalid-argument', 'The request data is invalid.');
    }
    return data;
}

function requireId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
        throw new HttpsError('invalid-argument', `${label} is invalid.`);
    }
    return value;
}

function optionalSeatIds(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
        throw new HttpsError('invalid-argument', 'Seat selection is invalid.');
    }

    const ids = value.map((seatId) => requireId(seatId, 'Seat ID'));
    if (new Set(ids).size !== ids.length) {
        throw new HttpsError('invalid-argument', 'Seat selection contains duplicates.');
    }
    return ids;
}

function requirePositiveInteger(value, label, maximum = 20) {
    let parsed = null;
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        parsed = value;
    } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const candidate = Number(value.trim());
        if (Number.isSafeInteger(candidate)) parsed = candidate;
    }
    if (parsed === null || parsed < 1 || parsed > maximum) {
        throw new HttpsError('invalid-argument', `${label} must be between 1 and ${maximum}.`);
    }
    return parsed;
}

function moneyAmount(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || Math.abs(value) > maxCurrencyAmount) return null;
        const cents = Math.round(value * 100);
        if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.000001) return null;
        return cents / 100;
    }
    if (typeof value !== 'string') return null;

    const text = value.trim();
    const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) return null;
    const whole = Number(match[1]);
    const fractional = Number(`${match[2] || ''}00`.slice(0, 2));
    const cents = whole * 100 + fractional;
    if (!Number.isSafeInteger(cents) || cents > maxCurrencyAmount * 100) return null;
    return cents / 100;
}

function requirePrice(value) {
    const parsed = moneyAmount(value);
    if (parsed === null || parsed <= 0) {
        throw new HttpsError('invalid-argument', 'Resale price is invalid.');
    }
    return parsed;
}

function requireWalletAddress(value, message = 'Connect a valid Ethereum wallet before continuing.') {
    const walletAddress = String(value || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new HttpsError('failed-precondition', message);
    }
    return walletAddress;
}

function categoryForSection(categories, sectionId) {
    if (Array.isArray(categories)) {
        const legacy = categories.find((category) =>
            category?.sectionId === sectionId || category?.section === sectionId || category?.id === sectionId
        );
        return legacy ? { sectionId, ...legacy } : null;
    }

    const category = categories?.[sectionId];
    return category ? { sectionId, ...category } : null;
}

function requireTicketCategory(category) {
    const name = typeof category?.name === 'string' ? category.name.trim() : '';
    const price = moneyAmount(category?.price);
    if (!name || name.length > 120 || price === null || price <= 0) {
        throw new HttpsError('failed-precondition', 'This ticket category is not available.');
    }
    return { name, price };
}

function configuredMaxTickets(event) {
    const value = event?.maxTicketsPerBuyer;
    try {
        return requirePositiveInteger(value, 'Maximum tickets per buyer', maxTicketsPerBuyer);
    } catch {
        // Older events did not always persist this setting. Fall back to the
        // product default, but never let malformed configuration raise a cap.
        return 4;
    }
}

function requireReservationSeatIds(value) {
    const ids = optionalSeatIds(value);
    if (!ids.length) {
        throw new HttpsError('invalid-argument', 'Select at least one seat to release.');
    }
    return ids;
}

function eventSeatId(eventId, sourceSeatId) {
    return `${eventId}_${sourceSeatId}`;
}

function chunks(items, size = 400) {
    const result = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}

/**
 * Physical Seats describe a reusable venue layout. EventSeats is the
 * event-scoped inventory that carries reservations and sales. Initializing
 * lazily keeps organizer CRUD simple, while batch.create ensures a later
 * caller never resets seats another checkout has already reserved or sold.
 */
async function ensureEventInventory(event) {
    if (!event?.id || !event.venueId) {
        throw new HttpsError('failed-precondition', 'This event has no venue inventory.');
    }

    const rawCategoryEntries = Array.isArray(event.categories)
        ? event.categories.map((category) => [
            category?.sectionId ?? category?.section ?? category?.id,
            category,
        ])
        : event.categories && typeof event.categories === 'object'
            ? Object.entries(event.categories)
            : [];
    const categoryEntries = [];
    const seenSections = new Set();
    rawCategoryEntries.forEach(([rawSectionId, category]) => {
        const sectionId = typeof rawSectionId === 'string' ? rawSectionId.trim() : '';
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(sectionId)
            || !category
            || typeof category !== 'object'
            || Array.isArray(category)) {
            throw new HttpsError('failed-precondition', 'This event has an invalid ticket category configuration.');
        }
        if (seenSections.has(sectionId)) {
            throw new HttpsError('failed-precondition', 'This event maps more than one category to the same section.');
        }
        seenSections.add(sectionId);

        let quantity;
        try {
            quantity = requirePositiveInteger(
                category.quantity ?? category.available,
                'Ticket category quantity',
                maxInventoryPerCategory
            );
        } catch {
            throw new HttpsError('failed-precondition', 'This event has an invalid ticket category quantity.');
        }
        const normalizedCategory = requireTicketCategory(category);
        categoryEntries.push({ sectionId, quantity, ...normalizedCategory });
    });
    if (!categoryEntries.length) {
        throw new HttpsError('failed-precondition', 'This event has no ticket inventory configured.');
    }

    const physicalSeats = await db.collection('Seats')
        .where('venueId', '==', event.venueId)
        .get();
    const physicalBySection = new Map();
    physicalSeats.docs.forEach((seat) => {
        const value = { id: seat.id, ...seat.data() };
        const sectionId = typeof value.sectionId === 'string' ? value.sectionId.trim() : '';
        const seatLabel = typeof value.seatLabel === 'string' ? value.seatLabel.trim() : '';
        if (!sectionId || !seatLabel || seatLabel.length > 160) return;
        const sectionSeats = physicalBySection.get(sectionId) || [];
        sectionSeats.push(value);
        physicalBySection.set(sectionId, sectionSeats);
    });

    const desiredSeats = [];
    categoryEntries.forEach(({ sectionId, quantity }) => {
        const availablePhysicalSeats = (physicalBySection.get(sectionId) || [])
            .sort((left, right) => String(left.seatLabel).localeCompare(String(right.seatLabel)));
        if (availablePhysicalSeats.length < quantity) {
            throw new HttpsError(
                'failed-precondition',
                `The ${sectionId} allocation exceeds the venue's physical seats.`
            );
        }
        availablePhysicalSeats.slice(0, quantity).forEach((sourceSeat) => {
            desiredSeats.push({
                ref: db.collection('EventSeats').doc(eventSeatId(event.id, sourceSeat.id)),
                data: {
                    eventId: event.id,
                    venueId: event.venueId,
                    sourceSeatId: sourceSeat.id,
                    sectionId,
                    seatLabel: sourceSeat.seatLabel,
                    status: 'AVAILABLE',
                    reservedBy: '',
                    reservedAt: '',
                    reservationExpiry: '',
                    reservationEventId: '',
                    bookingId: '',
                    createdAt: now(),
                    updatedAt: now(),
                },
            });
        });
    });

    for (const seatChunk of chunks(desiredSeats)) {
        // A concurrent first reservation can create the same inventory. Retry
        // once after re-reading rather than falling back to a destructive set.
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const existing = await db.getAll(...seatChunk.map((seat) => seat.ref));
            const missing = seatChunk.filter((seat, index) => !existing[index].exists);
            if (!missing.length) break;

            const batch = db.batch();
            missing.forEach((seat) => batch.create(seat.ref, seat.data));
            try {
                await batch.commit();
                break;
            } catch (error) {
                const alreadyExists = error?.code === 6
                    || error?.code === 'already-exists'
                    || String(error?.code || '').includes('already-exists');
                if (attempt === 1 || !alreadyExists) {
                    throw error;
                }
            }
        }
    }
}

// Policy dates from the current UI are date-only values. Interpret those in
// the product's Malaysia/Singapore business timezone (+08:00), with end dates
// inclusive through the end of the listed day. Invalid configured dates fail
// closed rather than accidentally leaving sales open.
function policyDateMilliseconds(value, endOfDay = false) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        const calendarDate = new Date(Date.UTC(year, month - 1, day));
        if (calendarDate.getUTCFullYear() !== year
            || calendarDate.getUTCMonth() !== month - 1
            || calendarDate.getUTCDate() !== day) {
            return null;
        }
        const suffix = endOfDay ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00';
        const parsed = Date.parse(`${raw}${suffix}`);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function policyWindowIsOpen(startValue, endValue, date = new Date()) {
    const nowMilliseconds = date.getTime();
    if (startValue) {
        const startMilliseconds = policyDateMilliseconds(startValue, false);
        if (startMilliseconds === null || startMilliseconds > nowMilliseconds) return false;
    }
    if (endValue) {
        const endMilliseconds = policyDateMilliseconds(endValue, true);
        if (endMilliseconds === null || endMilliseconds < nowMilliseconds) return false;
    }
    return true;
}

function reservationIsActive(seat, currentTime = Date.now()) {
    const expiry = Date.parse(seat?.reservationExpiry || '');
    return Number.isFinite(expiry) && expiry > currentTime;
}

function salesAreOpen(event, date = new Date()) {
    return event.status === 'PUBLISHED'
        && policyWindowIsOpen(event.salesStartDate, event.salesEndDate, date);
}

async function ensurePurchasableEventInventory(eventId, uid) {
    const actor = await getActor(uid);
    if (actor.role !== 'buyer' || actor.status !== 'active' || actor.emailVerified !== true) {
        throw new HttpsError('permission-denied', 'An active, verified buyer account is required.');
    }
    const eventSnap = await db.collection('Events').doc(eventId).get();
    if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
    const event = { id: eventSnap.id, ...eventSnap.data() };
    if (!salesAreOpen(event)) {
        throw new HttpsError('failed-precondition', 'Ticket sales are not open for this event.');
    }
    await ensureEventInventory(event);
}

function resaleIsOpen(event, date = new Date()) {
    return event.status === 'PUBLISHED'
        && event.resaleEnabled === true
        && policyWindowIsOpen(event.resaleStartDate, event.resaleDeadline, date);
}

function bookingNumber() {
    return `TS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function auditDoc(action, entityType, entityId, actor, details = {}) {
    return {
        action,
        entityType,
        entityId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role || '',
        details,
        result: 'success',
        timestamp: now(),
    };
}

async function getActiveBuyer(tx, uid) {
    const userRef = db.collection('Users').doc(uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
        throw new HttpsError('permission-denied', 'Your user profile was not found.');
    }

    const user = { uid, ...userSnap.data() };
    if (user.role !== 'buyer' || user.status !== 'active' || user.emailVerified !== true) {
        throw new HttpsError('permission-denied', 'An active, verified buyer account is required.');
    }
    return user;
}

async function ownedTicketCount(tx, eventId, ownerUid) {
    const ownedTickets = db.collection('NFTTickets')
        .where('eventId', '==', eventId)
        .where('ownerUid', '==', ownerUid);
    const ownedTicketsSnap = await tx.get(ownedTickets);
    return ownedTicketsSnap.size;
}

async function getActor(uid, tx = null) {
    const userRef = db.collection('Users').doc(uid);
    const snap = tx ? await tx.get(userRef) : await userRef.get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'Your user profile was not found.');
    }
    return { uid, ...snap.data() };
}

function notification(recipientUid, message, type, relatedType, relatedId) {
    return {
        recipientUid,
        message,
        type,
        relatedEntityType: relatedType,
        relatedEntityId: relatedId,
        read: false,
        createdAt: now(),
    };
}

// These records make the current simulated-chain state visible to
// administrators without pretending that a real blockchain transaction was
// submitted. A production mint/transfer integration should replace the
// PENDING state and blank hash with a provider-confirmed transaction.
function simulatedBlockchainRecord(transactionType, ticketId, walletAddress, relatedEntityType, relatedEntityId, timestamp) {
    return {
        transactionHash: '',
        walletAddress: walletAddress || '',
        transactionType,
        ticketId,
        relatedEntityType,
        relatedEntityId,
        status: 'PENDING',
        network: 'SIMULATED — no chain submission',
        failureReason: '',
        timestamp,
    };
}

/**
 * Atomically allocate the next available seats, create a confirmed booking, and
 * issue ticket records. Replace the simulated payment state with a verified
 * payment-provider webhook before using this in production.
 */
exports.checkout = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const eventId = requireId(data.eventId, 'Event ID');
    const sectionId = requireId(data.sectionId, 'Section ID');
    const requestedSeatDocIds = optionalSeatIds(data.seatDocIds);
    const requestedQuantity = requirePositiveInteger(
        data.quantity ?? data.qty ?? requestedSeatDocIds.length,
        'Quantity'
    );
    if (requestedSeatDocIds.length && requestedSeatDocIds.length !== requestedQuantity) {
        throw new HttpsError('invalid-argument', 'Seat selection does not match the requested quantity.');
    }

    await ensurePurchasableEventInventory(eventId, uid);

    const result = await db.runTransaction(async (tx) => {
        const buyer = await getActiveBuyer(tx, uid);
        const walletAddress = requireWalletAddress(buyer.walletAddress, 'Connect a valid wallet before checkout.');

        const eventRef = db.collection('Events').doc(eventId);
        const eventSnap = await tx.get(eventRef);
        if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
        const event = { id: eventSnap.id, ...eventSnap.data() };

        if (!salesAreOpen(event)) {
            throw new HttpsError('failed-precondition', 'Ticket sales are not open for this event.');
        }

        const category = categoryForSection(event.categories, sectionId);
        const ticketCategory = requireTicketCategory(category);

        const maxPerBuyer = configuredMaxTickets(event);
        if (requestedQuantity > maxPerBuyer) {
            throw new HttpsError('invalid-argument', `A maximum of ${maxPerBuyer} tickets is allowed.`);
        }

        const alreadyHeld = await ownedTicketCount(tx, eventId, uid);
        if (alreadyHeld + requestedQuantity > maxPerBuyer) {
            throw new HttpsError('failed-precondition', `You may hold ${Math.max(0, maxPerBuyer - alreadyHeld)} more ticket(s) for this event.`);
        }

        let selectedSeats;
        if (requestedSeatDocIds.length) {
            const reservedSnaps = await Promise.all(requestedSeatDocIds.map((seatId) =>
                tx.get(db.collection('EventSeats').doc(seatId))
            ));
            const currentTime = Date.now();
            selectedSeats = reservedSnaps.map((seat) => ({ id: seat.id, ...seat.data() }));
            const invalidReservation = selectedSeats.some((seat) =>
                !seat.id ||
                seat.eventId !== eventId ||
                seat.venueId !== event.venueId ||
                seat.sectionId !== sectionId ||
                seat.status !== 'RESERVED' ||
                seat.reservedBy !== uid ||
                (seat.reservationEventId && seat.reservationEventId !== eventId) ||
                !reservationIsActive(seat, currentTime)
            );
            if (invalidReservation) {
                throw new HttpsError('failed-precondition', 'Your reservation has expired. Choose seats again.');
            }
        } else {
            const seatsQuery = db.collection('EventSeats')
                .where('eventId', '==', eventId)
                .where('venueId', '==', event.venueId)
                .where('sectionId', '==', sectionId)
                .where('status', '==', 'AVAILABLE')
                .orderBy('seatLabel', 'asc')
                .limit(requestedQuantity);
            const seatsSnap = await tx.get(seatsQuery);
            if (seatsSnap.size !== requestedQuantity) {
                throw new HttpsError('failed-precondition', 'The requested number of seats is no longer available.');
            }
            selectedSeats = seatsSnap.docs.map((seat) => ({ id: seat.id, ...seat.data() }));
        }
        const seatLabels = selectedSeats.map((seat) => seat.seatLabel);
        const unitPrice = ticketCategory.price;
        const totalAmount = Math.round((unitPrice * requestedQuantity + serviceCharge) * 100) / 100;
        const bookingRef = db.collection('Bookings').doc();
        const createdAt = now();
        const ticketIds = [];

        const generatedBookingNumber = bookingNumber();
        tx.set(bookingRef, {
            bookingNumber: generatedBookingNumber,
            buyerUid: uid,
            buyerName: buyer.fullName || '',
            organizerUid: event.organizerUid || '',
            eventId,
            eventName: event.name || '',
            categoryName: ticketCategory.name,
            sectionId,
            seats: seatLabels,
            seatDocIds: selectedSeats.map((seat) => seat.id),
            quantity: requestedQuantity,
            unitPrice,
            serviceCharge,
            totalAmount,
            status: 'CONFIRMED',
            paymentStatus: 'SIMULATED_PAID',
            walletAddress,
            createdAt,
            updatedAt: createdAt,
        });

        for (const seat of selectedSeats) {
            const ticketRef = db.collection('NFTTickets').doc();
            ticketIds.push(ticketRef.id);
            tx.update(db.collection('EventSeats').doc(seat.id), {
                status: 'SOLD',
                bookingId: bookingRef.id,
                reservedBy: '',
                reservedAt: '',
                reservationExpiry: '',
                reservationEventId: '',
                updatedAt: createdAt,
            });
            tx.set(ticketRef, {
                bookingId: bookingRef.id,
                organizerUid: event.organizerUid || '',
                eventId,
                eventName: event.name || '',
                categoryName: ticketCategory.name,
                sectionId,
                seatId: seat.seatLabel,
                ownerUid: uid,
                walletAddress,
                tokenId: '',
                status: 'VALID',
                mintingStatus: 'PENDING',
                transactionHash: '',
                qrData: `TKSECURE:${ticketRef.id}:${eventId}:${seat.seatLabel}`,
                usedAt: '',
                transferHistory: [],
                createdAt,
                updatedAt: createdAt,
            });
            tx.set(db.collection('BlockchainTransactions').doc(), simulatedBlockchainRecord(
                'MINT',
                ticketRef.id,
                walletAddress,
                'booking',
                bookingRef.id,
                createdAt
            ));
        }

        tx.set(db.collection('Notifications').doc(), notification(
            uid,
            `Booking confirmed. Your ${requestedQuantity} NFT ticket(s) are being issued.`,
            'booking_confirmed',
            'booking',
            bookingRef.id
        ));
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'booking_created',
            'booking',
            bookingRef.id,
            buyer,
            { eventId, sectionId, quantity: requestedQuantity }
        ));

        return {
            id: bookingRef.id,
            bookingNumber: generatedBookingNumber,
            seatLabels,
            ticketIds,
            totalAmount,
            paymentStatus: 'SIMULATED_PAID',
        };
    });

    return result;
});

/**
 * Creates a short-lived, caller-owned seat reservation. Expired reservations
 * are reclaimed during the next reservation attempt for the same section.
 */
exports.reserveSeats = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const eventId = requireId(data.eventId, 'Event ID');
    const venueId = requireId(data.venueId, 'Venue ID');
    const sectionId = requireId(data.sectionId, 'Section ID');
    const quantity = requirePositiveInteger(data.quantity, 'Quantity');
    const expiryMinutes = requirePositiveInteger(data.expiryMinutes ?? 10, 'Reservation duration', 30);

    await ensurePurchasableEventInventory(eventId, uid);

    return db.runTransaction(async (tx) => {
        const buyer = await getActiveBuyer(tx, uid);
        const eventSnap = await tx.get(db.collection('Events').doc(eventId));
        if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
        const event = { id: eventSnap.id, ...eventSnap.data() };
        if (event.venueId !== venueId || !salesAreOpen(event)) {
            throw new HttpsError('failed-precondition', 'Seat reservations are not available for this event.');
        }
        requireTicketCategory(categoryForSection(event.categories, sectionId));
        const maxPerBuyer = configuredMaxTickets(event);
        if (quantity > maxPerBuyer) {
            throw new HttpsError('invalid-argument', 'The reservation exceeds the per-buyer ticket limit.');
        }

        const reservationQuery = db.collection('EventSeats')
            .where('eventId', '==', eventId)
            .where('venueId', '==', venueId)
            .where('sectionId', '==', sectionId)
            .where('status', '==', 'RESERVED')
            .orderBy('seatLabel', 'asc')
            .limit(100);
        const availableQuery = db.collection('EventSeats')
            .where('eventId', '==', eventId)
            .where('venueId', '==', venueId)
            .where('sectionId', '==', sectionId)
            .where('status', '==', 'AVAILABLE')
            .orderBy('seatLabel', 'asc')
            .limit(quantity);
        const ownedReservationsQuery = db.collection('EventSeats')
            .where('eventId', '==', eventId)
            .where('reservedBy', '==', uid)
            .where('status', '==', 'RESERVED')
            .limit(100);
        const [reservationSnap, availableSnap, ownedReservationsSnap] = await Promise.all([
            tx.get(reservationQuery),
            tx.get(availableQuery),
            tx.get(ownedReservationsQuery),
        ]);

        const currentTime = Date.now();
        const reservations = reservationSnap.docs.map((seat) => ({ id: seat.id, ...seat.data() }));
        const ownedReservations = ownedReservationsSnap.docs.map((seat) => ({ id: seat.id, ...seat.data() }));
        const activeOwnedReservations = ownedReservations.filter((seat) => reservationIsActive(seat, currentTime));
        const ownedActive = activeOwnedReservations.filter((seat) =>
            seat.venueId === venueId && seat.sectionId === sectionId
        );
        const otherActiveReservationCount = activeOwnedReservations.length - ownedActive.length;
        const alreadyHeld = await ownedTicketCount(tx, eventId, uid);
        if (alreadyHeld + otherActiveReservationCount + quantity > maxPerBuyer) {
            throw new HttpsError('failed-precondition', 'Your active seat reservations already reach the per-buyer ticket limit for this event.');
        }
        const expired = reservations.filter((seat) => !reservationIsActive(seat, currentTime));
        const retained = ownedActive.slice(0, quantity);
        const candidates = [
            ...availableSnap.docs.map((seat) => ({ id: seat.id, ...seat.data() })),
            ...expired,
        ].sort((left, right) => String(left.seatLabel).localeCompare(String(right.seatLabel)));
        const selected = [...retained, ...candidates.slice(0, quantity - retained.length)];
        if (selected.length !== quantity) {
            throw new HttpsError('failed-precondition', 'The requested number of seats is no longer available.');
        }

        const selectedIds = new Set(selected.map((seat) => seat.id));
        const release = [
            ...ownedActive.slice(quantity),
            ...expired.filter((seat) => !selectedIds.has(seat.id)),
        ];
        const timestamp = now();
        const reservationExpiry = new Date(currentTime + expiryMinutes * 60 * 1000).toISOString();
        release.forEach((seat) => {
            tx.update(db.collection('EventSeats').doc(seat.id), {
                status: 'AVAILABLE',
                reservedBy: '',
                reservedAt: '',
                reservationExpiry: '',
                reservationEventId: '',
                updatedAt: timestamp,
            });
        });
        selected.forEach((seat) => {
            tx.update(db.collection('EventSeats').doc(seat.id), {
                status: 'RESERVED',
                reservedBy: uid,
                reservedAt: timestamp,
                reservationExpiry,
                reservationEventId: eventId,
                updatedAt: timestamp,
            });
        });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'seats_reserved', 'event', eventId, buyer, { sectionId, quantity }
        ));

        return {
            seats: selected.map((seat) => ({ id: seat.id, seatLabel: seat.seatLabel, sectionId: seat.sectionId })),
            reservationExpiry,
        };
    });
});

exports.releaseSeatReservation = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const eventId = requireId(data.eventId, 'Event ID');
    const seatDocIds = requireReservationSeatIds(data.seatDocIds);

    const released = await db.runTransaction(async (tx) => {
        const buyer = await getActiveBuyer(tx, uid);
        const seatSnaps = await Promise.all(seatDocIds.map((seatId) => tx.get(db.collection('EventSeats').doc(seatId))));
        const timestamp = now();
        let releasedCount = 0;
        seatSnaps.forEach((seatSnap) => {
            if (!seatSnap.exists) return;
            const seat = seatSnap.data();
            if (seat.eventId === eventId && seat.status === 'RESERVED' && seat.reservedBy === uid) {
                tx.update(seatSnap.ref, {
                    status: 'AVAILABLE',
                    reservedBy: '',
                    reservedAt: '',
                    reservationExpiry: '',
                    reservationEventId: '',
                    updatedAt: timestamp,
                });
                releasedCount += 1;
            }
        });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'seat_reservation_released', 'event', eventId, buyer, { seatCount: seatDocIds.length }
        ));
        return releasedCount;
    });

    return { released };
});

exports.transferTicket = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const ticketId = requireId(data.ticketId, 'Ticket ID');
    const recipientWallet = requireWalletAddress(
        data.recipientWallet,
        'Enter a valid recipient wallet address.'
    );
    let recipientUid = '';

    await db.runTransaction(async (tx) => {
        const actor = await getActiveBuyer(tx, uid);
        const recipientSnap = await tx.get(
            db.collection('Users').where('walletAddress', '==', recipientWallet).limit(2)
        );
        if (recipientSnap.size !== 1) {
            throw new HttpsError('failed-precondition', 'The recipient must be a registered user with this wallet connected.');
        }
        const recipient = { uid: recipientSnap.docs[0].id, ...recipientSnap.docs[0].data() };
        if (recipient.uid === uid) {
            throw new HttpsError('failed-precondition', 'You already own this ticket.');
        }
        if (recipient.role !== 'buyer' || recipient.status !== 'active' || recipient.emailVerified !== true) {
            throw new HttpsError('failed-precondition', 'The recipient must be an active, verified buyer account.');
        }
        const ticketRef = db.collection('NFTTickets').doc(ticketId);
        const ticketSnap = await tx.get(ticketRef);
        if (!ticketSnap.exists) throw new HttpsError('not-found', 'Ticket not found.');
        const ticket = { id: ticketSnap.id, ...ticketSnap.data() };
        if (ticket.ownerUid !== uid || ticket.status !== 'VALID') {
            throw new HttpsError('permission-denied', 'This ticket cannot be transferred.');
        }

        const eventSnap = await tx.get(db.collection('Events').doc(ticket.eventId));
        const event = eventSnap.exists ? eventSnap.data() : null;
        if (!event || event.status !== 'PUBLISHED' || event.transferEnabled === false) {
            throw new HttpsError('failed-precondition', 'Transfers are not enabled for this event.');
        }
        const maxPerBuyer = Number(event.maxTicketsPerBuyer) || 4;
        const recipientTicketCount = await ownedTicketCount(tx, ticket.eventId, recipient.uid);
        if (recipientTicketCount >= maxPerBuyer) {
            throw new HttpsError('failed-precondition', 'The recipient already holds the maximum number of tickets for this event.');
        }

        const timestamp = now();
        recipientUid = recipient.uid;
        tx.update(ticketRef, {
            ownerUid: recipient.uid,
            walletAddress: recipientWallet,
            status: 'VALID',
            transferHistory: FieldValue.arrayUnion({
                fromUid: uid,
                fromWallet: ticket.walletAddress || '',
                toUid: recipient.uid,
                toWallet: recipientWallet,
                timestamp,
            }),
            updatedAt: timestamp,
        });
        tx.set(db.collection('Notifications').doc(), notification(
            recipient.uid,
            `A ticket for ${ticket.eventName || 'an event'} was transferred to your wallet.`,
            'ticket_transferred',
            'ticket',
            ticketId
        ));
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'ticket_transferred', 'ticket', ticketId, actor, { recipientUid: recipient.uid }
        ));
        tx.set(db.collection('BlockchainTransactions').doc(), simulatedBlockchainRecord(
            'TRANSFER',
            ticketId,
            recipientWallet,
            'ticket',
            ticketId,
            timestamp
        ));
    });

    return { ticketId, recipientUid };
});

exports.createResaleListing = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const ticketId = requireId(data.ticketId, 'Ticket ID');
    const resalePrice = requirePrice(data.resalePrice);

    return db.runTransaction(async (tx) => {
        const seller = await getActiveBuyer(tx, uid);
        const sellerWallet = requireWalletAddress(seller.walletAddress, 'Connect a valid wallet before listing a ticket.');
        const ticketRef = db.collection('NFTTickets').doc(ticketId);
        const ticketSnap = await tx.get(ticketRef);
        if (!ticketSnap.exists) throw new HttpsError('not-found', 'Ticket not found.');
        const ticket = { id: ticketSnap.id, ...ticketSnap.data() };
        if (ticket.ownerUid !== uid || ticket.status !== 'VALID') {
            throw new HttpsError('permission-denied', 'You do not have an eligible ticket to list.');
        }

        const eventSnap = await tx.get(db.collection('Events').doc(ticket.eventId));
        if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
        const event = { id: eventSnap.id, ...eventSnap.data() };
        if (!resaleIsOpen(event)) {
            throw new HttpsError('failed-precondition', 'Resale is not open for this event.');
        }

        const category = categoryForSection(event.categories, ticket.sectionId);
        const originalPrice = Math.round((Number(category?.price) || 0) * 100) / 100;
        const markup = Number(event.maxResaleMarkup) || 0;
        const configuredCap = Number(event.maxResalePrice) || 0;
        const maxAllowedPrice = configuredCap > 0
            ? configuredCap
            : Math.round((originalPrice * (1 + markup / 100)) * 100) / 100;
        if (resalePrice > maxAllowedPrice) {
            throw new HttpsError('failed-precondition', `The maximum permitted resale price is RM${maxAllowedPrice.toFixed(2)}.`);
        }

        const listingRef = db.collection('ResaleListings').doc();
        const timestamp = now();
        tx.set(listingRef, {
            ticketId,
            organizerUid: event.organizerUid || '',
            eventId: ticket.eventId,
            eventName: ticket.eventName || event.name || '',
            categoryName: ticket.categoryName || category?.name || '',
            sectionId: ticket.sectionId || '',
            seatId: ticket.seatId || '',
            sellerUid: uid,
            sellerWallet,
            buyerUid: '',
            buyerWallet: '',
            originalPrice,
            resalePrice,
            maxAllowedPrice,
            status: 'ACTIVE',
            ruleCompliance: 'COMPLIANT',
            riskFlag: '',
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        tx.update(ticketRef, { status: 'LISTED_FOR_RESALE', updatedAt: timestamp });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'resale_listing_created', 'resale', listingRef.id, seller, { ticketId, resalePrice }
        ));
        return { id: listingRef.id, maxAllowedPrice, originalPrice };
    });
});

exports.cancelResaleListing = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const listingId = requireId(data.listingId, 'Listing ID');

    await db.runTransaction(async (tx) => {
        const seller = await getActiveBuyer(tx, uid);
        const listingRef = db.collection('ResaleListings').doc(listingId);
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists) throw new HttpsError('not-found', 'Listing not found.');
        const listing = { id: listingSnap.id, ...listingSnap.data() };
        if (listing.sellerUid !== uid || listing.status !== 'ACTIVE') {
            throw new HttpsError('permission-denied', 'This listing cannot be cancelled.');
        }

        const timestamp = now();
        tx.update(listingRef, { status: 'CANCELLED', updatedAt: timestamp });
        tx.update(db.collection('NFTTickets').doc(listing.ticketId), { status: 'VALID', updatedAt: timestamp });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'resale_listing_cancelled', 'resale', listingId, seller, { ticketId: listing.ticketId }
        ));
    });

    return { listingId, status: 'CANCELLED' };
});

exports.updateResalePrice = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const listingId = requireId(data.listingId, 'Listing ID');
    const resalePrice = requirePrice(data.resalePrice);

    return db.runTransaction(async (tx) => {
        const seller = await getActiveBuyer(tx, uid);
        const listingRef = db.collection('ResaleListings').doc(listingId);
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists) throw new HttpsError('not-found', 'Listing not found.');
        const listing = { id: listingSnap.id, ...listingSnap.data() };
        if (listing.sellerUid !== uid || listing.status !== 'ACTIVE') {
            throw new HttpsError('permission-denied', 'This listing cannot be repriced.');
        }

        const eventSnap = await tx.get(db.collection('Events').doc(listing.eventId));
        if (!eventSnap.exists || !resaleIsOpen(eventSnap.data())) {
            throw new HttpsError('failed-precondition', 'Resale is not available for this event.');
        }
        const event = eventSnap.data();
        const category = categoryForSection(event.categories, listing.sectionId);
        const originalPrice = Math.round((Number(category?.price) || Number(listing.originalPrice) || 0) * 100) / 100;
        const configuredCap = Number(event.maxResalePrice) || 0;
        const markup = Number(event.maxResaleMarkup) || 0;
        const maxAllowedPrice = configuredCap > 0
            ? configuredCap
            : Math.round((originalPrice * (1 + markup / 100)) * 100) / 100;
        if (resalePrice > maxAllowedPrice) {
            throw new HttpsError('failed-precondition', `The maximum permitted resale price is RM${maxAllowedPrice.toFixed(2)}.`);
        }

        const timestamp = now();
        tx.update(listingRef, {
            originalPrice,
            resalePrice,
            maxAllowedPrice,
            ruleCompliance: 'COMPLIANT',
            updatedAt: timestamp,
        });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'resale_price_updated', 'resale', listingId, seller, { resalePrice }
        ));
        return { listingId, resalePrice, maxAllowedPrice };
    });
});

exports.suspendResaleListing = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const listingId = requireId(data.listingId, 'Listing ID');
    const reason = typeof data.reason === 'string' && data.reason.trim()
        ? data.reason.trim().slice(0, 1000)
        : 'Suspended by an administrator.';

    return db.runTransaction(async (tx) => {
        const admin = await getActor(uid, tx);
        if (admin.role !== 'admin' || admin.status !== 'active' || admin.emailVerified !== true) {
            throw new HttpsError('permission-denied', 'Only administrators can suspend listings.');
        }

        const listingRef = db.collection('ResaleListings').doc(listingId);
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists) throw new HttpsError('not-found', 'Listing not found.');
        const listing = { id: listingSnap.id, ...listingSnap.data() };
        if (listing.status !== 'ACTIVE') {
            throw new HttpsError('failed-precondition', 'Only active listings can be suspended.');
        }

        const timestamp = now();
        tx.update(listingRef, { status: 'SUSPENDED', riskFlag: reason, updatedAt: timestamp });
        tx.update(db.collection('NFTTickets').doc(listing.ticketId), { status: 'VALID', updatedAt: timestamp });
        tx.set(db.collection('Notifications').doc(), notification(
            listing.sellerUid,
            `Your resale listing was suspended: ${reason}`,
            'resale_suspended',
            'resale',
            listingId
        ));
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'resale_listing_suspended', 'resale', listingId, admin, { reason }
        ));
        return { listingId, status: 'SUSPENDED' };
    });
});

exports.purchaseResale = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const listingId = requireId(data.listingId, 'Listing ID');

    return db.runTransaction(async (tx) => {
        const buyer = await getActiveBuyer(tx, uid);
        const buyerWallet = requireWalletAddress(buyer.walletAddress, 'Connect a valid wallet before purchasing.');

        const listingRef = db.collection('ResaleListings').doc(listingId);
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists) throw new HttpsError('not-found', 'Listing not found.');
        const listing = { id: listingSnap.id, ...listingSnap.data() };
        if (listing.status !== 'ACTIVE' || listing.sellerUid === uid) {
            throw new HttpsError('failed-precondition', 'This listing is no longer available.');
        }

        const eventSnap = await tx.get(db.collection('Events').doc(listing.eventId));
        if (!eventSnap.exists || !resaleIsOpen(eventSnap.data())) {
            throw new HttpsError('failed-precondition', 'Resale is not available for this event.');
        }
        const maxPerBuyer = Number(eventSnap.data().maxTicketsPerBuyer) || 4;
        const buyerTicketCount = await ownedTicketCount(tx, listing.eventId, uid);
        if (buyerTicketCount >= maxPerBuyer) {
            throw new HttpsError('failed-precondition', 'You already hold the maximum number of tickets for this event.');
        }

        const ticketRef = db.collection('NFTTickets').doc(listing.ticketId);
        const ticketSnap = await tx.get(ticketRef);
        if (!ticketSnap.exists || ticketSnap.data().status !== 'LISTED_FOR_RESALE') {
            throw new HttpsError('failed-precondition', 'The ticket is no longer available.');
        }

        const timestamp = now();
        tx.update(listingRef, {
            status: 'SOLD',
            buyerUid: uid,
            buyerWallet,
            completedAt: timestamp,
            paymentStatus: 'SIMULATED_PAID',
            updatedAt: timestamp,
        });
        tx.update(ticketRef, {
            ownerUid: uid,
            walletAddress: buyerWallet,
            status: 'VALID',
            transferHistory: FieldValue.arrayUnion({
                fromUid: listing.sellerUid,
                fromWallet: listing.sellerWallet || '',
                toUid: uid,
                toWallet: buyerWallet,
                timestamp,
                type: 'RESALE',
            }),
            updatedAt: timestamp,
        });
        tx.set(db.collection('Notifications').doc(), notification(
            listing.sellerUid,
            'Your resale listing has been sold.',
            'resale_sold',
            'resale',
            listingId
        ));
        tx.set(db.collection('Notifications').doc(), notification(
            uid,
            'Your resale ticket purchase is complete.',
            'resale_purchased',
            'resale',
            listingId
        ));
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'resale_completed', 'resale', listingId, buyer, { ticketId: listing.ticketId }
        ));
        tx.set(db.collection('BlockchainTransactions').doc(), simulatedBlockchainRecord(
            'RESALE',
            listing.ticketId,
            buyerWallet,
            'resale',
            listingId,
            timestamp
        ));
        return { listingId, ticketId: listing.ticketId, totalAmount: Number(listing.resalePrice) + serviceCharge };
    });
});

exports.scanTicket = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    const data = requireDataObject(request);
    const ticketId = requireId(data.ticketId, 'Ticket ID');
    const eventId = requireId(data.eventId, 'Event ID');

    return db.runTransaction(async (tx) => {
        const actor = await getActor(uid, tx);
        if (!['admin', 'organizer'].includes(actor.role)
            || actor.status !== 'active'
            || actor.emailVerified !== true) {
            throw new HttpsError('permission-denied', 'Only authorized event personnel can scan tickets.');
        }

        const eventSnap = await tx.get(db.collection('Events').doc(eventId));
        if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
        const event = eventSnap.data();
        if (event.status !== 'PUBLISHED') {
            throw new HttpsError('failed-precondition', 'Entry scanning is disabled for this event.');
        }
        if (actor.role === 'organizer' && event.organizerUid !== uid) {
            throw new HttpsError('permission-denied', 'You are not authorized for this event.');
        }

        const ticketRef = db.collection('NFTTickets').doc(ticketId);
        const ticketSnap = await tx.get(ticketRef);
        if (!ticketSnap.exists || ticketSnap.data().eventId !== eventId) {
            return { valid: false, reason: 'Ticket is not valid for this event.' };
        }
        const ticket = ticketSnap.data();
        if (ticket.status !== 'VALID') {
            return { valid: false, reason: 'Ticket is no longer valid for entry.' };
        }

        const timestamp = now();
        tx.update(ticketRef, { status: 'USED', usedAt: timestamp, updatedAt: timestamp });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'ticket_verified', 'ticket', ticketId, actor, { eventId }
        ));
        return {
            valid: true,
            reason: 'ENTRY ALLOWED',
            ticket: { id: ticketId, ...ticket, status: 'USED', usedAt: timestamp },
        };
    });
});

/**
 * Firebase Authentication is the authority for verification state. The
 * browser can ask this callable to project a verified ID-token claim into the
 * profile, but cannot set emailVerified directly in Firestore.
 */
exports.syncEmailVerification = onCall({ region, enforceAppCheck: false }, async (request) => {
    const uid = requireAuth(request);
    if (request.auth.token.email_verified !== true) {
        throw new HttpsError('failed-precondition', 'Verify your email address before syncing this status.');
    }

    const timestamp = now();
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('Users').doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new HttpsError('not-found', 'Your user profile was not found.');
        }
        const user = { uid, ...userSnap.data() };
        tx.update(userRef, { emailVerified: true, updatedAt: timestamp });
        tx.set(db.collection('AuditLogs').doc(), auditDoc(
            'email_verified', 'user', uid, user, {}
        ));
    });

    return { emailVerified: true };
});

/**
 * Admin event moderation is a permitted direct Firestore operation, but an
 * inactive event must never leave purchasable listings on the marketplace.
 * This trusted trigger closes all active listings after a cancellation or
 * suspension. purchaseResale also checks event status synchronously, so a
 * purchase is rejected even during the short trigger propagation window.
 */
exports.closeResaleForInactiveEvent = onDocumentUpdated(
    { document: 'Events/{eventId}', region, retry: true },
    async (change) => {
        const before = change.data?.before?.data();
        const after = change.data?.after?.data();
        const inactiveStatuses = ['SUSPENDED', 'CANCELLED'];
        if (!before || !after || before.status === after.status || !inactiveStatuses.includes(after.status)) {
            return;
        }

        const eventId = change.params.eventId;
        // Firestore events are delivered at least once and can arrive out of
        // order. Do not close a marketplace that has since been republished.
        const currentEventSnap = await db.collection('Events').doc(eventId).get();
        const currentStatus = currentEventSnap.exists ? currentEventSnap.data().status : '';
        if (!inactiveStatuses.includes(currentStatus)) return;

        const listingsSnap = await db.collection('ResaleListings')
            .where('eventId', '==', eventId)
            .where('status', '==', 'ACTIVE')
            .get();
        const timestamp = now();
        const reason = `Event ${String(currentStatus).toLowerCase()}; resale is unavailable.`;

        for (const listingChunk of chunks(listingsSnap.docs, 100)) {
            const latestEventSnap = await db.collection('Events').doc(eventId).get();
            const latestStatus = latestEventSnap.exists ? latestEventSnap.data().status : '';
            if (!inactiveStatuses.includes(latestStatus)) return;
            const ticketRefs = listingChunk
                .map((listing) => String(listing.data().ticketId || '').trim())
                .filter(Boolean)
                .map((ticketId) => db.collection('NFTTickets').doc(ticketId));
            const ticketSnaps = ticketRefs.length ? await db.getAll(...ticketRefs) : [];
            const existingTicketIds = new Set(ticketSnaps.filter((ticket) => ticket.exists).map((ticket) => ticket.id));
            const batch = db.batch();

            listingChunk.forEach((listing) => {
                const listingData = listing.data();
                batch.update(listing.ref, {
                    status: 'SUSPENDED',
                    riskFlag: reason,
                    updatedAt: timestamp,
                });
                if (existingTicketIds.has(listingData.ticketId)) {
                    batch.update(db.collection('NFTTickets').doc(listingData.ticketId), {
                        status: 'VALID',
                        updatedAt: timestamp,
                    });
                }
                if (listingData.sellerUid) {
                    batch.set(db.collection('Notifications').doc(), notification(
                        listingData.sellerUid,
                        `Your resale listing was closed because the event is ${String(latestStatus).toLowerCase()}.`,
                        'resale_closed_event_inactive',
                        'event',
                        eventId
                    ));
                }
                batch.set(db.collection('AuditLogs').doc(), {
                    action: 'resale_closed_event_inactive',
                    entityType: 'resale',
                    entityId: listing.id,
                    actorUid: 'system',
                    actorEmail: '',
                    actorRole: 'system',
                    details: { eventId, eventStatus: latestStatus },
                    result: 'success',
                    timestamp,
                });
            });
            await batch.commit();
        }
    }
);
