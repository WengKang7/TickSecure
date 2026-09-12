/**
 * TickSecure — Firestore CRUD Services
 * Central service layer for all Firestore operations, organized by entity.
 * Exposed globally as window.ts<ServiceName> for use by page scripts.
 */
import { db, auth, storage } from './firebase-init.js';
import { invokeTrustedBackend, usingLocalPhpBackend } from './backend-client.js';
import {
    collection, doc, addDoc, setDoc, getDoc, getDocs,
    updateDoc, deleteDoc, query, where, orderBy, limit,
    writeBatch, runTransaction, increment, arrayUnion, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ============================================================
// HELPERS
// ============================================================
function uid() {
    if (!auth.currentUser) throw new Error('You must be signed in.');
    return auth.currentUser.uid;
}

let _profileCache = null;
auth.onAuthStateChanged(() => { _profileCache = null; });

async function profile() {
    if (_profileCache && _profileCache._uid === auth.currentUser?.uid) return _profileCache;
    const u = uid();
    const snap = await getDoc(doc(db, 'Users', u));
    if (!snap.exists()) throw new Error('User profile not found.');
    _profileCache = { _uid: u, id: u, ...snap.data() };
    return _profileCache;
}

function iso() { return new Date().toISOString(); }
function genRef(prefix) {
    const timePart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}${timePart}${randomPart}`;
}

function asAmount(value, fallback = 0) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Returns the single Event.categories shape used in Firestore:
 * { [sectionId]: { name, price, quantity } }.
 *
 * It also understands the legacy category arrays currently produced by older
 * screens, so existing events remain readable while new writes are canonical.
 */
export function normalizeEventCategories(categories, resolveSectionId = null) {
    const normalized = {};

    const addCategory = (fallbackSectionId, value) => {
        if (!value || typeof value !== 'object') return;

        const suppliedSectionId = String(
            value.sectionId ?? value.id ?? value.section ?? fallbackSectionId ?? ''
        ).trim();
        const resolvedSectionId = String(
            (typeof resolveSectionId === 'function'
                ? resolveSectionId(suppliedSectionId, value)
                : suppliedSectionId) ?? suppliedSectionId
        ).trim();

        if (!resolvedSectionId) return;

        normalized[resolvedSectionId] = {
            name: String(value.name ?? value.categoryName ?? resolvedSectionId).trim() || resolvedSectionId,
            price: asAmount(value.price ?? value.unitPrice),
            quantity: Math.max(0, Math.floor(asAmount(value.quantity ?? value.available)))
        };
    };

    if (Array.isArray(categories)) {
        categories.forEach((category, index) => addCategory(String(index), category));
    } else if (categories && typeof categories === 'object') {
        Object.entries(categories).forEach(([sectionId, category]) => addCategory(sectionId, category));
    }

    return normalized;
}

// Read-time aliases keep legacy display pages working without storing duplicate fields.
function withTicketAliases(ticket) {
    return {
        ...ticket,
        category: ticket.category ?? ticket.categoryName ?? '',
        seat: ticket.seat ?? ticket.seatId ?? '',
        ownerWallet: ticket.ownerWallet ?? ticket.walletAddress ?? ''
    };
}

function withBookingAliases(booking) {
    return {
        ...booking,
        category: booking.category ?? booking.categoryName ?? '',
        seat: booking.seat ?? (Array.isArray(booking.seats) ? booking.seats.join(', ') : '')
    };
}

function withNotificationAliases(notification) {
    return {
        ...notification,
        isRead: notification.isRead ?? notification.read ?? false
    };
}

function withResaleAliases(listing) {
    return {
        ...listing,
        askingPrice: listing.askingPrice ?? listing.resalePrice ?? 0,
        sellerId: listing.sellerId ?? listing.sellerUid ?? '',
        ticketCategory: listing.ticketCategory ?? listing.categoryName ?? ''
    };
}

function callableFunctionConfig(configured) {
    if (typeof configured === 'string' && configured.trim()) {
        return { name: configured.trim() };
    }
    if (configured && typeof configured === 'object' && typeof configured.name === 'string' && configured.name.trim()) {
        return { name: configured.name.trim(), region: configured.region };
    }
    return null;
}

const DEFAULT_FUNCTION_REGION = 'asia-southeast1';

/**
 * High-risk state changes are performed by a trusted backend. Keeping the
 * names configurable supports both the Functions Emulator and the explicit
 * local XAMPP/PHP bridge without ever falling back to browser-side writes.
 */
function secureFunctionConfig(globalKey, firebaseKey, functionName) {
    return callableFunctionConfig(window[globalKey] ?? window.tsFirebase?.[firebaseKey])
        ?? { name: functionName, region: DEFAULT_FUNCTION_REGION };
}

function getCheckoutFunctionConfig() {
    return secureFunctionConfig('tsCheckoutFunction', 'checkoutFunction', 'checkout');
}

function getSeatReservationFunctionConfig() {
    return secureFunctionConfig('tsSeatReservationFunction', 'seatReservationFunction', 'reserveSeats');
}

function getSeatReleaseFunctionConfig() {
    const explicitConfig = callableFunctionConfig(
        window.tsSeatReleaseFunction ?? window.tsFirebase?.seatReleaseFunction
    );
    if (explicitConfig) return explicitConfig;

    const reservationConfig = getSeatReservationFunctionConfig();
    return reservationConfig
        ? { name: 'releaseSeatReservation', region: reservationConfig.region || DEFAULT_FUNCTION_REGION }
        : { name: 'releaseSeatReservation', region: DEFAULT_FUNCTION_REGION };
}

function clientCheckoutFallbackAllowed() {
    // High-risk workflows must use the callable backend in every environment.
    // Never fall back to browser-side financial or inventory writes.
    return false;
}

async function invokeCallable(request, config) {
    return invokeTrustedBackend(request, config);
}

async function checkoutWithCallable(request, config) {
    const response = await invokeCallable(request, config);
    const bookingId = response.id || response.bookingId;
    if (!bookingId) throw new Error('The secure checkout service returned no booking ID.');
    return { ...response, id: bookingId };
}

async function uploadFile(path, file, allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf']) {
    const allowedTypes = new Set(allowedMimeTypes);
    if (!file || !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
        const fileTypes = allowedMimeTypes.includes('application/pdf') ? 'JPG, PNG, or PDF' : 'JPG or PNG';
        throw new Error(`Uploads must be a ${fileTypes} file no larger than 10 MB.`);
    }

    const safeBaseName = String(file.name || 'upload')
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/^\.+/, '')
        .slice(0, 120) || 'upload';
    const normalizedPath = String(path || '').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) throw new Error('Upload path is invalid.');

    if (usingLocalPhpBackend()) {
        const backend = window.tsFirebase?.backend;
        if (!backend?.compatible) {
            throw new Error(
                'PHP backend mode cannot be used with Firebase Emulator mode. Use either ?firebaseEmulator=1 or ?firebaseBackend=php, not both.'
            );
        }
        const localUploadToken = (() => {
            if (typeof window.tsLocalUploadToken === 'string') return window.tsLocalUploadToken.trim();
            try { return String(window.localStorage.getItem('ticksecure.localUploadToken') || '').trim(); }
            catch (_) { return ''; }
        })();
        if (localUploadToken.length < 32) {
            throw new Error(
                'Local uploads need the matching ticksecure.localUploadToken browser setting. See api/README.md before retrying.'
            );
        }
        if (!backend?.uploadEndpoint || !backend?.projectUrl) {
            throw new Error('The local PHP upload endpoint is not configured.');
        }

        const formData = new FormData();
        formData.append('file', file, safeBaseName);
        let response;
        try {
            response = await fetch(backend.uploadEndpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-TickSecure-Upload-Mode': 'local-dev',
                    'X-TickSecure-Local-Upload-Token': localUploadToken
                },
                body: formData
            });
        } catch (_) {
            throw new Error('The local upload service could not be reached. Check that XAMPP Apache is running.');
        }
        let payload = null;
        try { payload = await response.json(); }
        catch (_) { throw new Error('The local upload service returned an invalid response.'); }
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || 'The local upload service rejected this file.');
        }
        const localPath = String(payload.path || '');
        if (!/^uploads\/local\/\d{4}\/\d{2}\/[a-f0-9]{40}\.(?:jpg|png|pdf)$/.test(localPath)) {
            throw new Error('The local upload service returned an unsafe file path.');
        }
        return {
            url: new URL(localPath, backend.projectUrl).href,
            localPath
        };
    }

    const objectRef = ref(storage, `${normalizedPath}/${Date.now()}_${safeBaseName}`);
    await uploadBytes(objectRef, file, { contentType: file.type });
    return { url: await getDownloadURL(objectRef), localPath: '' };
}

// ============================================================
// AUDIT SERVICE — immutable system log
// ============================================================
export const AuditService = {
    async log(action, entityType, entityId = '', details = {}) {
        // AuditLogs are intentionally backend-only. High-risk callable flows
        // emit authoritative records in Functions; ordinary browser CRUD must
        // not forge an immutable audit trail or trigger denied writes.
        void action;
        void entityType;
        void entityId;
        void details;
    },

    async getLogs(filters = {}) {
        const c = [];
        if (filters.actorRole) c.push(where('actorRole', '==', filters.actorRole));
        if (filters.action) c.push(where('action', '==', filters.action));
        if (filters.entityType) c.push(where('entityType', '==', filters.entityType));
        const snap = await getDocs(query(collection(db, 'AuditLogs'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    }
};

// ============================================================
// NOTIFICATION SERVICE
// ============================================================
export const NotificationService = {
    async create(recipientUid, message, type = 'info', relatedType = '', relatedId = '') {
        await addDoc(collection(db, 'Notifications'), {
            recipientUid, message, type,
            relatedEntityType: relatedType, relatedEntityId: relatedId,
            read: false, createdAt: iso()
        });
    },

    async getForUser(userUid = null) {
        const u = userUid || uid();
        const snap = await getDocs(query(
            collection(db, 'Notifications'),
            where('recipientUid', '==', u),
            orderBy('createdAt', 'desc'),
            limit(50)
        ));
        return snap.docs.map(d => withNotificationAliases({ id: d.id, ...d.data() }));
    },

    async markRead(notifId) {
        await updateDoc(doc(db, 'Notifications', notifId), { read: true });
    },

    async markAllRead() {
        const items = await this.getForUser();
        const batch = writeBatch(db);
        items.filter(n => !n.read).forEach(n => batch.update(doc(db, 'Notifications', n.id), { read: true }));
        await batch.commit();
    },

    async delete(notifId) {
        await deleteDoc(doc(db, 'Notifications', notifId));
    },

    async getUnreadCount(userUid = null) {
        const u = userUid || uid();
        const snap = await getDocs(query(
            collection(db, 'Notifications'),
            where('recipientUid', '==', u),
            where('read', '==', false)
        ));
        return snap.size;
    }
};

// ============================================================
// USER SERVICE
// ============================================================
export const UserService = {
    async getUsers(filters = {}) {
        const c = [];
        if (filters.role) c.push(where('role', '==', filters.role));
        if (filters.status) c.push(where('status', '==', filters.status));
        const snap = await getDocs(query(collection(db, 'Users'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getUser(userId) {
        const snap = await getDoc(doc(db, 'Users', userId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async updateProfile(userId, data) {
        await updateDoc(doc(db, 'Users', userId), { ...data, updatedAt: iso() });
        await AuditService.log('profile_updated', 'user', userId, data);
    },

    async suspendUser(userId, reason) {
        await updateDoc(doc(db, 'Users', userId), { status: 'suspended', suspendReason: reason, updatedAt: iso() });
        await AuditService.log('user_suspended', 'user', userId, { reason });
        await NotificationService.create(userId, `Your account has been suspended. Reason: ${reason}`, 'account_suspended');
    },

    async reactivateUser(userId) {
        await updateDoc(doc(db, 'Users', userId), { status: 'active', suspendReason: '', updatedAt: iso() });
        await AuditService.log('user_reactivated', 'user', userId);
        await NotificationService.create(userId, 'Your account has been reactivated.', 'account_reactivated');
    },

    async getOrganizerProfile(userId) {
        const snap = await getDoc(doc(db, 'OrganizerProfiles', userId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async updateOrganizerProfile(userId, data) {
        await updateDoc(doc(db, 'OrganizerProfiles', userId), data);
        await AuditService.log('organizer_profile_updated', 'organizer', userId, data);
    },

    async approveOrganizer(userId) {
        await updateDoc(doc(db, 'Users', userId), { status: 'active', updatedAt: iso() });
        await AuditService.log('organizer_approved', 'user', userId);
        await NotificationService.create(userId, 'Your organizer application has been approved! You can now create events.', 'organizer_approved');
    },

    async rejectOrganizer(userId, reason) {
        await updateDoc(doc(db, 'Users', userId), { status: 'rejected', rejectReason: reason, updatedAt: iso() });
        await AuditService.log('organizer_rejected', 'user', userId, { reason });
        await NotificationService.create(userId, `Your organizer application was rejected: ${reason}`, 'organizer_rejected');
    },

    async getCurrentProfile() {
        return profile();
    }
};

// ============================================================
// VENUE SERVICE
// ============================================================
export const VenueService = {
    async createVenue(data) {
        const ref = await addDoc(collection(db, 'Venues'), {
            name: data.name,
            address: data.address,
            capacity: parseInt(data.capacity, 10) || 0,
            layoutStatus: 'DRAFT',
            sections: [],
            blueprintUrl: '',
            createdAt: iso(),
            updatedAt: iso(),
            createdBy: uid()
        });
        await AuditService.log('venue_created', 'venue', ref.id, { name: data.name });
        return ref.id;
    },

    async getVenues() {
        const snap = await getDocs(query(collection(db, 'Venues'), orderBy('createdAt', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getActiveVenues() {
        const snap = await getDocs(query(
            collection(db, 'Venues'),
            where('layoutStatus', '==', 'ACTIVE')
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getVenue(venueId) {
        const snap = await getDoc(doc(db, 'Venues', venueId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async updateVenue(venueId, data) {
        await updateDoc(doc(db, 'Venues', venueId), { ...data, updatedAt: iso() });
        await AuditService.log('venue_updated', 'venue', venueId, data);
    },

    async deleteVenue(venueId) {
        await deleteDoc(doc(db, 'Venues', venueId));
        await AuditService.log('venue_deleted', 'venue', venueId);
    },

    async uploadBlueprint(venueId, file) {
        const upload = await uploadFile(`venues/${venueId}`, file);
        const url = upload.url;
        await updateDoc(doc(db, 'Venues', venueId), { 
            blueprintUrl: url, 
            blueprintName: file.name,
            blueprintSize: file.size,
            updatedAt: iso() 
        });
        return url;
    },

    async updateSections(venueId, sections) {
        const venue = await this.getVenue(venueId);
        if (!venue) throw new Error('Venue not found.');
        if (venue.layoutStatus === 'ACTIVE' || venue.layoutStatus === 'PROCESSING') {
            throw new Error('An active venue layout is locked. Create a new venue layout to change its sections.');
        }
        const totalSeats = sections.reduce((s, sec) => s + (parseInt(sec.seatCount, 10) || 0), 0);
        await updateDoc(doc(db, 'Venues', venueId), {
            sections, capacity: totalSeats, updatedAt: iso()
        });
        await AuditService.log('venue_sections_updated', 'venue', venueId, { sectionCount: sections.length, totalSeats });
    },

    async activateLayout(venueId) {
        const venue = await this.getVenue(venueId);
        if (!venue) throw new Error('Venue not found.');
        if (!venue.sections || venue.sections.length === 0) throw new Error('No sections configured.');
        if (venue.layoutStatus === 'ACTIVE') return;

        // Physical venue seats are reusable by EventSeats. Write them in
        // capped batches so normal large venue layouts stay below Firestore's
        // 500-operation batch limit. Keeping PROCESSING on failure also makes
        // a retry explicit rather than incorrectly marking a partial layout
        // active.
        await updateDoc(doc(db, 'Venues', venueId), { layoutStatus: 'PROCESSING', updatedAt: iso() });
        const physicalSeats = [];
        const createdAt = iso();
        for (const section of venue.sections) {
            for (let i = 1; i <= section.seatCount; i++) {
                const label = `${section.sectionId}${String(i).padStart(2, '0')}`;
                physicalSeats.push({
                    ref: doc(db, 'Seats', `${venueId}_${label}`),
                    data: {
                    venueId, sectionId: section.sectionId,
                    seatLabel: label, status: 'AVAILABLE',
                    createdAt,
                    updatedAt: createdAt
                    }
                });
            }
        }
        for (let offset = 0; offset < physicalSeats.length; offset += 450) {
            const batch = writeBatch(db);
            physicalSeats.slice(offset, offset + 450).forEach(seat => batch.set(seat.ref, seat.data));
            await batch.commit();
        }
        await updateDoc(doc(db, 'Venues', venueId), { layoutStatus: 'ACTIVE', updatedAt: iso() });
        await AuditService.log('venue_layout_activated', 'venue', venueId);
    }
};

// ============================================================
// EVENT SERVICE
// ============================================================
export const EventService = {
    async createEvent(data) {
        const p = await profile();
        const ref = await addDoc(collection(db, 'Events'), {
            name: data.name,
            description: data.description || '',
            eventCategory: data.eventCategory || 'Concert',
            date: data.date,
            time: data.time || '',
            venueId: data.venueId,
            venueName: data.venueName || '',
            venueLocation: data.venueLocation || '',
            organizerUid: p.id,
            organizerName: data.organizerName || p.fullName || '',
            status: 'DRAFT',
            posterUrl: '',
            startingPrice: '',
            availability: 'Available',
            categories: {},
            maxTicketsPerBuyer: parseInt(data.maxTicketsPerBuyer, 10) || 4,
            salesStartDate: data.salesStartDate || '',
            salesEndDate: data.salesEndDate || '',
            transferEnabled: data.transferEnabled !== false,
            resaleEnabled: data.resaleEnabled !== false,
            resaleStartDate: data.resaleStartDate || '',
            resaleDeadline: data.resaleDeadline || '',
            maxResaleMarkup: parseFloat(data.maxResaleMarkup) || 0,
            maxResalePrice: parseFloat(data.maxResalePrice) || 0,
            statusHistory: [{ from: '', to: 'DRAFT', changedBy: p.id, timestamp: iso() }],
            createdAt: iso(),
            updatedAt: iso()
        });
        await AuditService.log('event_created', 'event', ref.id, { name: data.name });
        return ref.id;
    },

    async getEvents(filters = {}) {
        const c = [];
        if (filters.status) c.push(where('status', '==', filters.status));
        if (filters.organizerUid) c.push(where('organizerUid', '==', filters.organizerUid));
        const snap = await getDocs(query(collection(db, 'Events'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side to avoid requiring composite indexes
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getPublishedEvents() {
        const snap = await getDocs(query(
            collection(db, 'Events'),
            where('status', '==', 'PUBLISHED')
        ));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side to avoid requiring composite indexes
        results.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return results;
    },

    async getEvent(eventId) {
        const snap = await getDoc(doc(db, 'Events', eventId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async updateEvent(eventId, data) {
        await updateDoc(doc(db, 'Events', eventId), { ...data, updatedAt: iso() });
        await AuditService.log('event_updated', 'event', eventId, data);
    },

    async uploadPoster(eventId, file) {
        const upload = await uploadFile(`events/${eventId}`, file, ['image/jpeg', 'image/png']);
        const url = upload.url;
        await updateDoc(doc(db, 'Events', eventId), { posterUrl: url, updatedAt: iso() });
        return url;
    },

    async updateCategories(eventId, categories) {
        // Persist only { [sectionId]: { name, price, quantity } }.
        // Older configuration pages submit arrays with a venue section *name*,
        // so translate that name to its physical section ID before saving.
        const event = await this.getEvent(eventId);
        const sectionIdsByLegacyValue = new Map();
        if (event?.venueId) {
            const venue = await VenueService.getVenue(event.venueId);
            (venue?.sections || []).forEach(section => {
                const sectionId = String(section.sectionId ?? '').trim();
                if (!sectionId) return;
                sectionIdsByLegacyValue.set(sectionId.toLowerCase(), sectionId);
                sectionIdsByLegacyValue.set(String(section.name ?? '').trim().toLowerCase(), sectionId);
            });
        }

        const normalizedCategories = normalizeEventCategories(categories, suppliedSectionId => {
            const key = String(suppliedSectionId ?? '').trim().toLowerCase();
            return sectionIdsByLegacyValue.get(key) || suppliedSectionId;
        });
        const prices = Object.values(normalizedCategories).map(category => category.price);
        const startingPrice = prices.length ? `RM${Math.min(...prices)}` : '';
        await updateDoc(doc(db, 'Events', eventId), {
            categories: normalizedCategories,
            startingPrice,
            updatedAt: iso()
        });
        await AuditService.log('event_categories_updated', 'event', eventId);
    },

    async submitForApproval(eventId) {
        const evt = await this.getEvent(eventId);
        if (!evt) throw new Error('Event not found.');
        if (evt.status !== 'DRAFT') throw new Error('Only draft events can be submitted.');
        await updateDoc(doc(db, 'Events', eventId), {
            status: 'PENDING_REVIEW',
            statusHistory: arrayUnion({ from: 'DRAFT', to: 'PENDING_REVIEW', changedBy: uid(), timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('event_submitted', 'event', eventId);
    },

    async approveEvent(eventId) {
        if (usingLocalPhpBackend()) {
            return invokeCallable({ eventId: String(eventId || '').trim(), status: 'PUBLISHED' }, { name: 'moderateEvent' });
        }
        await updateDoc(doc(db, 'Events', eventId), {
            status: 'PUBLISHED',
            statusHistory: arrayUnion({ from: 'PENDING_REVIEW', to: 'PUBLISHED', changedBy: uid(), timestamp: iso() }),
            updatedAt: iso()
        });
        const evt = await this.getEvent(eventId);
        await AuditService.log('event_approved', 'event', eventId);
        if (evt) await NotificationService.create(evt.organizerUid, `Your event "${evt.name}" has been approved and published!`, 'event_approved', 'event', eventId);
    },

    async rejectEvent(eventId, reason) {
        if (usingLocalPhpBackend()) {
            return invokeCallable({
                eventId: String(eventId || '').trim(),
                status: 'REJECTED',
                reason: String(reason || '').trim()
            }, { name: 'moderateEvent' });
        }
        await updateDoc(doc(db, 'Events', eventId), {
            status: 'REJECTED', rejectReason: reason,
            statusHistory: arrayUnion({ from: 'PENDING_REVIEW', to: 'REJECTED', reason, changedBy: uid(), timestamp: iso() }),
            updatedAt: iso()
        });
        const evt = await this.getEvent(eventId);
        await AuditService.log('event_rejected', 'event', eventId, { reason });
        if (evt) await NotificationService.create(evt.organizerUid, `Your event "${evt.name}" was rejected: ${reason}`, 'event_rejected', 'event', eventId);
    },

    async suspendEvent(eventId, reason) {
        if (usingLocalPhpBackend()) {
            return invokeCallable({
                eventId: String(eventId || '').trim(),
                status: 'SUSPENDED',
                reason: String(reason || '').trim()
            }, { name: 'moderateEvent' });
        }
        const evt = await this.getEvent(eventId);
        await updateDoc(doc(db, 'Events', eventId), {
            status: 'SUSPENDED',
            statusHistory: arrayUnion({ from: evt?.status || '', to: 'SUSPENDED', reason, changedBy: uid(), timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('event_suspended', 'event', eventId, { reason });
        if (evt) await NotificationService.create(evt.organizerUid, `Your event "${evt.name}" has been suspended: ${reason}`, 'event_suspended', 'event', eventId);
    },

    async cancelEvent(eventId, reason) {
        if (usingLocalPhpBackend()) {
            return invokeCallable({
                eventId: String(eventId || '').trim(),
                status: 'CANCELLED',
                reason: String(reason || '').trim()
            }, { name: 'moderateEvent' });
        }
        const evt = await this.getEvent(eventId);
        await updateDoc(doc(db, 'Events', eventId), {
            status: 'CANCELLED',
            statusHistory: arrayUnion({ from: evt?.status || '', to: 'CANCELLED', reason, changedBy: uid(), timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('event_cancelled', 'event', eventId, { reason });
        if (evt) await NotificationService.create(evt.organizerUid, `Your event "${evt.name}" has been cancelled: ${reason}`, 'event_cancelled', 'event', eventId);
    },

    async deleteEvent(eventId) {
        const evt = await this.getEvent(eventId);
        if (evt && evt.status !== 'DRAFT') throw new Error('Only draft events can be deleted.');
        await deleteDoc(doc(db, 'Events', eventId));
        await AuditService.log('event_deleted', 'event', eventId);
    },

    async getOrganizerEvents() {
        return this.getEvents({ organizerUid: uid() });
    }
};

// ============================================================
// SEAT SERVICE
// ============================================================
export const SeatService = {
    async getSeats(eventId, venueId, sectionId = null) {
        if (!eventId || !venueId) return [];
        const c = [
            where('eventId', '==', eventId),
            where('venueId', '==', venueId)
        ];
        if (sectionId) c.push(where('sectionId', '==', sectionId));
        const snap = await getDocs(query(collection(db, 'EventSeats'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (a.seatLabel || '').localeCompare(b.seatLabel || ''));
        
        return results;
    },

    async getAvailableSeats(eventId, venueId, sectionId, count = 1) {
        if (!eventId || !venueId || !sectionId) return [];
        const requestedCount = Math.max(1, Math.min(parseInt(count, 10) || 1, 500));
        const snap = await getDocs(query(
            collection(db, 'EventSeats'),
            where('eventId', '==', eventId),
            where('venueId', '==', venueId),
            where('sectionId', '==', sectionId),
            where('status', '==', 'AVAILABLE'),
            orderBy('seatLabel', 'asc'),
            limit(requestedCount)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /**
     * Allocates the next available seats. In production this delegates seat
     * selection to a callable Function; local Firestore writes are dev-only.
     */
    async reserveNextAvailableSeats({ eventId, venueId, sectionId, count, expiryMinutes = 10 }) {
        const requestedCount = Math.max(1, Math.min(parseInt(count, 10) || 1, 30));
        const request = {
            eventId: String(eventId || '').trim(),
            venueId: String(venueId || '').trim(),
            sectionId: String(sectionId || '').trim(),
            quantity: requestedCount,
            expiryMinutes: Math.max(1, Math.min(parseInt(expiryMinutes, 10) || 10, 30))
        };
        if (!request.eventId || !request.venueId || !request.sectionId) {
            throw new Error('Your ticket category is incomplete. Please select it again.');
        }

        const callableConfig = getSeatReservationFunctionConfig();
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            const response = await invokeCallable(request, callableConfig);
            const seats = Array.isArray(response.seats)
                ? response.seats
                    .map(seat => ({ ...seat, id: seat.id || seat.seatDocId }))
                    .filter(seat => seat.id && seat.seatLabel)
                : [];
            if (seats.length !== requestedCount || !response.reservationExpiry) {
                throw new Error('The secure reservation service returned an incomplete seat assignment.');
            }
            return {
                seats,
                reservationExpiry: response.reservationExpiry,
                reservationId: response.reservationId || ''
            };
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure seat reservation is not configured. Please try again later.');
        }

        const availableSeats = await this.getAvailableSeats(
            request.eventId, request.venueId, request.sectionId, requestedCount
        );
        if (availableSeats.length < requestedCount) {
            throw new Error('Not enough seats are available in this ticket category.');
        }
        return this.reserveSeats(availableSeats.map(seat => seat.id), request);
    },

    /**
     * Reserves concrete seat document IDs atomically. The caller may display
     * labels from the returned records, but cannot choose a different venue or
     * section than the records actually belong to.
     */
    async reserveSeats(seatIds, options = {}) {
        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Direct seat reservations are available only in local development.');
        }
        const uniqueSeatIds = [...new Set((seatIds || [])
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim()))];
        if (!uniqueSeatIds.length) throw new Error('Select at least one available seat.');

        const buyerUid = uid();
        const expiryMinutes = Math.max(1, Math.min(parseInt(options.expiryMinutes, 10) || 10, 30));
        const reservationExpiry = new Date(Date.now() + expiryMinutes * 60000).toISOString();
        const reservedAt = iso();
        const expectedVenueId = String(options.venueId || '').trim();
        const expectedSectionId = String(options.sectionId || '').trim();
        const reservationEventId = String(options.eventId || '').trim();

        const seats = await runTransaction(db, async transaction => {
            const seatRefs = uniqueSeatIds.map(id => doc(db, 'EventSeats', id));
            const snapshots = await Promise.all(seatRefs.map(seatRef => transaction.get(seatRef)));
            const now = Date.now();
            const reservedSeats = [];

            snapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) throw new Error('One of the selected seats no longer exists.');

                const seat = snapshot.data();
                if (reservationEventId && seat.eventId !== reservationEventId) {
                    throw new Error('A selected seat does not belong to this event.');
                }
                if (expectedVenueId && seat.venueId !== expectedVenueId) {
                    throw new Error('A selected seat does not belong to this event venue.');
                }
                if (expectedSectionId && seat.sectionId !== expectedSectionId) {
                    throw new Error('A selected seat does not belong to this ticket category.');
                }

                const existingExpiry = Date.parse(seat.reservationExpiry || '');
                const expiredReservation = seat.status === 'RESERVED'
                    && Number.isFinite(existingExpiry)
                    && existingExpiry <= now;
                const activeReservationByBuyer = seat.status === 'RESERVED'
                    && seat.reservedBy === buyerUid
                    && (!Number.isFinite(existingExpiry) || existingExpiry > now);

                if (seat.status !== 'AVAILABLE' && !expiredReservation && !activeReservationByBuyer) {
                    throw new Error('One or more seats were just reserved by another buyer. Please try again.');
                }
                if (activeReservationByBuyer && reservationEventId && seat.reservationEventId
                    && seat.reservationEventId !== reservationEventId) {
                    throw new Error('One or more seats are reserved for a different event.');
                }

                transaction.update(seatRefs[index], {
                    status: 'RESERVED',
                    reservedBy: buyerUid,
                    reservedAt,
                    reservationExpiry,
                    reservationEventId
                });
                reservedSeats.push({
                    id: snapshot.id,
                    ...seat,
                    status: 'RESERVED',
                    reservedBy: buyerUid,
                    reservedAt,
                    reservationExpiry,
                    reservationEventId
                });
            });

            return reservedSeats;
        });

        return { seats, reservationExpiry };
    },

    async confirmSeats(seatIds, bookingId) {
        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Direct seat confirmation is available only in local development.');
        }
        const uniqueSeatIds = [...new Set((seatIds || []).filter(Boolean))];
        const buyerUid = uid();
        await runTransaction(db, async transaction => {
            const seatRefs = uniqueSeatIds.map(id => doc(db, 'EventSeats', id));
            const snapshots = await Promise.all(seatRefs.map(seatRef => transaction.get(seatRef)));
            const now = Date.now();

            snapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) throw new Error('One of the reserved seats no longer exists.');
                const seat = snapshot.data();
                const expiry = Date.parse(seat.reservationExpiry || '');
                if (seat.status !== 'RESERVED' || seat.reservedBy !== buyerUid
                    || (Number.isFinite(expiry) && expiry <= now)) {
                    throw new Error('Your seat reservation has expired. Please choose seats again.');
                }
                transaction.update(seatRefs[index], {
                    status: 'SOLD',
                    bookingId,
                    reservedBy: '',
                    reservedAt: '',
                    reservationExpiry: '',
                    reservationEventId: ''
                });
            });
        });
    },

    async releaseSeats(seatIds, options = {}) {
        const uniqueSeatIds = [...new Set((seatIds || []).filter(Boolean))];
        if (!uniqueSeatIds.length) return 0;

        const callableConfig = getSeatReleaseFunctionConfig();
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            const response = await invokeCallable({
                eventId: String(options.eventId || '').trim(),
                seatDocIds: uniqueSeatIds
            }, callableConfig);
            return Number.isFinite(Number(response.released)) ? Number(response.released) : uniqueSeatIds.length;
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure seat release is not configured.');
        }

        const buyerUid = uid();
        return runTransaction(db, async transaction => {
            const seatRefs = uniqueSeatIds.map(id => doc(db, 'EventSeats', id));
            const snapshots = await Promise.all(seatRefs.map(seatRef => transaction.get(seatRef)));
            let released = 0;

            snapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) return;
                const seat = snapshot.data();
                // Never release a seat that was sold or reserved by another user.
                if (seat.status === 'RESERVED'
                    && seat.reservedBy === buyerUid
                    && (!options.eventId || seat.eventId === options.eventId)) {
                    transaction.update(seatRefs[index], {
                        status: 'AVAILABLE',
                        reservedBy: '',
                        reservedAt: '',
                        reservationExpiry: '',
                        reservationEventId: '',
                        bookingId: ''
                    });
                    released += 1;
                }
            });

            return released;
        });
    }
};

// ============================================================
// BOOKING SERVICE
// ============================================================
export const BookingService = {
    async createBooking(data) {
        const seatDocIds = [...new Set((data.seatDocIds || data.seatIds || [])
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim()))];
        const request = {
            eventId: String(data.eventId || '').trim(),
            sectionId: String(data.sectionId || '').trim(),
            seatDocIds,
            seatLabels: Array.isArray(data.seatLabels) ? data.seatLabels.map(String) : [],
            walletAddress: String(data.walletAddress || '').trim(),
            paymentMethod: data.paymentMethod || 'mock_card',
            serviceCharge: asAmount(data.serviceCharge, 20)
        };

        if (!request.eventId || !request.sectionId || !request.seatDocIds.length) {
            throw new Error('Your checkout session is incomplete. Please select ticket seats again.');
        }

        // Production checkout belongs in a trusted callable Function. The local
        // transaction below is deliberately restricted to development/emulator use.
        const callableConfig = getCheckoutFunctionConfig();
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return checkoutWithCallable({
                eventId: request.eventId,
                sectionId: request.sectionId,
                seatDocIds: request.seatDocIds,
                seatLabels: request.seatLabels,
                walletAddress: request.walletAddress,
                paymentMethod: request.paymentMethod
            }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure checkout is not configured. Please try again later.');
        }

        return this.createBookingLocally(request);
    },

    /**
     * Development/emulator fallback only. It atomically validates the buyer's
     * reservation, confirms the seats, creates the booking, and issues tickets.
     */
    async createBookingLocally(request) {
        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Local checkout has been removed. Use the secure checkout service.');
        }
        const p = await profile();
        const walletAddress = request.walletAddress || String(p.walletAddress || '').trim();
        if (!walletAddress) throw new Error('Connect a wallet before completing checkout.');

        const bookingRef = doc(collection(db, 'Bookings'));
        const bookingNumber = genRef('TS');
        const ticketEntries = request.seatDocIds.map(() => {
            const ticketId = `TS-TK-${doc(collection(db, 'NFTTickets')).id}`;
            return { id: ticketId, ref: doc(db, 'NFTTickets', ticketId) };
        });
        const createdAt = iso();

        const committed = await runTransaction(db, async transaction => {
            const eventRef = doc(db, 'Events', request.eventId);
            const seatRefs = request.seatDocIds.map(id => doc(db, 'EventSeats', id));
            const snapshots = await Promise.all([
                transaction.get(eventRef),
                ...seatRefs.map(seatRef => transaction.get(seatRef))
            ]);
            const eventSnapshot = snapshots[0];
            const seatSnapshots = snapshots.slice(1);

            if (!eventSnapshot.exists()) throw new Error('The selected event no longer exists.');
            const event = eventSnapshot.data();
            if (event.status !== 'PUBLISHED') throw new Error('Ticket sales are not available for this event.');

            const category = normalizeEventCategories(event.categories)[request.sectionId];
            if (!category) throw new Error('The selected ticket category is no longer available.');
            if (category.quantity < request.seatDocIds.length) {
                throw new Error('The selected quantity exceeds this category’s available allocation.');
            }

            const now = Date.now();
            const seatLabels = [];
            seatSnapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) throw new Error('One of your selected seats no longer exists.');
                const seat = snapshot.data();
                const reservationExpiry = Date.parse(seat.reservationExpiry || '');
                if (seat.eventId !== request.eventId
                    || seat.venueId !== event.venueId
                    || seat.sectionId !== request.sectionId) {
                    throw new Error('Your seat selection no longer matches this event category.');
                }
                if (seat.status !== 'RESERVED' || seat.reservedBy !== p.id
                    || (Number.isFinite(reservationExpiry) && reservationExpiry <= now)) {
                    throw new Error('Your seat reservation has expired. Please choose tickets again.');
                }
                if (seat.reservationEventId && seat.reservationEventId !== request.eventId) {
                    throw new Error('Your seats are reserved for a different event. Please choose tickets again.');
                }
                if (!seat.seatLabel) throw new Error('A selected seat is missing its seat label.');
                seatLabels.push(seat.seatLabel);

                transaction.update(seatRefs[index], {
                    status: 'SOLD',
                    bookingId: bookingRef.id,
                    reservedBy: '',
                    reservedAt: '',
                    reservationExpiry: '',
                    reservationEventId: ''
                });
            });

            const unitPrice = asAmount(category.price);
            const serviceCharge = Math.max(0, request.serviceCharge);
            const totalAmount = (unitPrice * seatLabels.length) + serviceCharge;
            const booking = {
                bookingNumber,
                buyerUid: p.id,
                buyerName: p.fullName || '',
                organizerUid: event.organizerUid || '',
                eventId: request.eventId,
                eventName: event.name || '',
                categoryName: category.name,
                sectionId: request.sectionId,
                seats: seatLabels,
                seatDocIds: request.seatDocIds,
                quantity: seatLabels.length,
                unitPrice,
                serviceCharge,
                totalAmount,
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                paymentMethod: request.paymentMethod,
                walletAddress,
                createdAt,
                updatedAt: createdAt
            };
            transaction.set(bookingRef, booking);

            ticketEntries.forEach((ticket, index) => {
                transaction.set(ticket.ref, {
                    bookingId: bookingRef.id,
                    organizerUid: event.organizerUid || '',
                    eventId: request.eventId,
                    eventName: event.name || '',
                    categoryName: category.name,
                    sectionId: request.sectionId,
                    seatId: seatLabels[index],
                    ownerUid: p.id,
                    walletAddress,
                    tokenId: '',
                    status: 'VALID',
                    mintingStatus: 'PENDING',
                    transactionHash: '',
                    qrData: `TKSECURE:${ticket.id}:${request.eventId}:${seatLabels[index]}`,
                    usedAt: '',
                    transferHistory: [],
                    createdAt,
                    updatedAt: createdAt
                });
            });

            return { booking, seatLabels };
        });

        // These are non-critical follow-up records; the atomic booking remains
        // successful even when a development-only simulation cannot be logged.
        ticketEntries.forEach(ticket => {
            BlockchainService.logTransaction({
                transactionType: 'MINT',
                ticketId: ticket.id,
                walletAddress,
                relatedEntityType: 'booking',
                relatedEntityId: bookingRef.id
            }).catch(error => console.warn('Blockchain simulation log failed:', error));
        });
        await AuditService.log('booking_created', 'booking', bookingRef.id, {
            bookingNumber,
            eventId: request.eventId
        });
        try {
            await NotificationService.create(
                p.id,
                `Booking ${bookingNumber} confirmed! Your NFT tickets are being issued.`,
                'booking_confirmed',
                'booking',
                bookingRef.id
            );
        } catch (error) {
            console.warn('Booking notification failed:', error);
        }

        return {
            id: bookingRef.id,
            bookingNumber,
            seatLabels: committed.seatLabels,
            ticketIds: ticketEntries.map(ticket => ticket.id),
            totalAmount: committed.booking.totalAmount,
            paymentStatus: committed.booking.paymentStatus
        };
    },

    async getBookings(filters = {}) {
        const c = [];
        const p = await profile();

        // Firestore rules require non-admin collection reads to be scoped to
        // the caller. Apply that constraint in one shared place so organizer
        // dashboards and buyer history pages do not accidentally issue broad,
        // denied queries.
        if (p.role === 'organizer') {
            if (filters.organizerUid && filters.organizerUid !== p.id) {
                throw new Error('Organizers can view bookings for their own events only.');
            }
            c.push(where('organizerUid', '==', p.id));
        } else if (p.role !== 'admin') {
            if (filters.buyerUid && filters.buyerUid !== p.id) {
                throw new Error('You can view only your own bookings.');
            }
            c.push(where('buyerUid', '==', p.id));
        } else if (filters.buyerUid) {
            c.push(where('buyerUid', '==', filters.buyerUid));
        }

        if (filters.organizerUid && p.role === 'admin') c.push(where('organizerUid', '==', filters.organizerUid));
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        if (filters.status) c.push(where('status', '==', filters.status));
        const snap = await getDocs(query(collection(db, 'Bookings'), ...c));
        let results = snap.docs.map(d => withBookingAliases({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getBooking(bookingId) {
        const snap = await getDoc(doc(db, 'Bookings', bookingId));
        return snap.exists() ? withBookingAliases({ id: snap.id, ...snap.data() }) : null;
    },

    async getUserBookings() {
        return this.getBookings({ buyerUid: uid() });
    },

    async updateStatus(bookingId, status) {
        throw new Error('Booking status is managed by trusted backend workflows.');
    }
};

// ============================================================
// TICKET (NFT) SERVICE
// ============================================================
export const TicketService = {
    async createTicket(data) {
        throw new Error('Ticket issuance is managed by the trusted checkout backend.');

        const ticketId = genRef('TS-TK-');
        await setDoc(doc(db, 'NFTTickets', ticketId), {
            bookingId: data.bookingId,
            eventId: data.eventId,
            eventName: data.eventName || '',
            categoryName: data.categoryName || '',
            sectionId: data.sectionId || '',
            seatId: data.seatId || '',
            ownerUid: data.ownerUid,
            walletAddress: data.walletAddress || '',
            tokenId: '',
            status: 'VALID',
            mintingStatus: 'PENDING',
            transactionHash: '',
            qrData: `TKSECURE:${ticketId}:${data.eventId}:${data.seatId}`,
            usedAt: '',
            transferHistory: [],
            createdAt: iso(),
            updatedAt: iso()
        });

        // Log blockchain transaction stub
        await BlockchainService.logTransaction({
            transactionType: 'MINT', ticketId,
            walletAddress: data.walletAddress || '',
            relatedEntityType: 'booking', relatedEntityId: data.bookingId
        });

        return ticketId;
    },

    async getTickets(filters = {}) {
        const c = [];
        const p = await profile();

        if (p.role === 'organizer') {
            if (filters.organizerUid && filters.organizerUid !== p.id) {
                throw new Error('Organizers can view tickets for their own events only.');
            }
            c.push(where('organizerUid', '==', p.id));
        } else if (p.role !== 'admin') {
            if (filters.ownerUid && filters.ownerUid !== p.id) {
                throw new Error('You can view only your own tickets.');
            }
            c.push(where('ownerUid', '==', p.id));
        } else if (filters.ownerUid) {
            c.push(where('ownerUid', '==', filters.ownerUid));
        }

        if (filters.organizerUid && p.role === 'admin') c.push(where('organizerUid', '==', filters.organizerUid));
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        if (filters.status) c.push(where('status', '==', filters.status));
        if (filters.bookingId) c.push(where('bookingId', '==', filters.bookingId));
        const snap = await getDocs(query(collection(db, 'NFTTickets'), ...c));
        let results = snap.docs.map(d => withTicketAliases({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getTicket(ticketId) {
        const snap = await getDoc(doc(db, 'NFTTickets', ticketId));
        return snap.exists() ? withTicketAliases({ id: snap.id, ...snap.data() }) : null;
    },

    async getUserTickets() {
        return this.getTickets({ ownerUid: uid() });
    },

    async transferTicket(ticketId, recipientWallet) {
        const callableConfig = secureFunctionConfig(
            'tsTransferTicketFunction', 'transferTicketFunction', 'transferTicket'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({
                ticketId: String(ticketId || '').trim(),
                recipientWallet: String(recipientWallet || '').trim()
            }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure ticket transfers are not configured.');
        }

        const ticket = await this.getTicket(ticketId);
        if (!ticket) throw new Error('Ticket not found.');
        if (ticket.ownerUid !== uid()) throw new Error('You do not own this ticket.');
        if (ticket.status !== 'VALID') throw new Error('Ticket is not transferable.');

        const recipientSnap = await getDocs(query(
            collection(db, 'Users'),
            where('walletAddress', '==', String(recipientWallet || '').trim()),
            limit(2)
        ));
        if (recipientSnap.size !== 1) {
            throw new Error('The recipient must have one registered connected wallet.');
        }
        const recipient = { id: recipientSnap.docs[0].id, ...recipientSnap.docs[0].data() };

        await updateDoc(doc(db, 'NFTTickets', ticketId), {
            ownerUid: recipient.id,
            walletAddress: recipientWallet,
            status: 'VALID',
            transferHistory: arrayUnion({
                fromUid: ticket.ownerUid,
                fromWallet: ticket.walletAddress,
                toUid: recipient.id,
                toWallet: recipientWallet,
                timestamp: iso()
            }),
            updatedAt: iso()
        });

        await BlockchainService.logTransaction({
            transactionType: 'TRANSFER', ticketId,
            walletAddress: recipientWallet,
            relatedEntityType: 'ticket', relatedEntityId: ticketId
        });

        await AuditService.log('ticket_transferred', 'ticket', ticketId, { to: recipientWallet });
        await NotificationService.create(recipient.id, `Ticket ${ticketId} has been transferred to you.`, 'ticket_transferred', 'ticket', ticketId);
        return { ticketId, recipientUid: recipient.id };
    },

    async verifyTicket(ticketId, eventId) {
        const callableConfig = secureFunctionConfig(
            'tsScanTicketFunction', 'scanTicketFunction', 'scanTicket'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({
                ticketId: String(ticketId || '').trim(),
                eventId: String(eventId || '').trim()
            }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure ticket scanning is not configured.');
        }

        const ticket = await this.getTicket(ticketId);
        if (!ticket) return { valid: false, reason: 'Invalid ticket — not found in system.' };
        if (ticket.eventId !== eventId) return { valid: false, reason: 'This ticket is for a different event.' };
        if (ticket.status === 'USED') return { valid: false, reason: 'Ticket has already been used.' };
        if (ticket.status === 'CANCELLED') return { valid: false, reason: 'Ticket has been cancelled.' };
        if (ticket.status === 'TRANSFERRED') return { valid: false, reason: 'Ticket ownership has been transferred.' };

        // Mark as used
        await updateDoc(doc(db, 'NFTTickets', ticketId), { status: 'USED', usedAt: iso(), updatedAt: iso() });
        await AuditService.log('ticket_verified', 'ticket', ticketId, { eventId });

        return {
            valid: true, reason: 'ENTRY ALLOWED',
            ticket: { ...ticket, status: 'USED' }
        };
    },

    async updateMintingStatus(ticketId, mintingStatus, txHash = '') {
        throw new Error('Ticket minting status is managed by the trusted backend.');
    }
};

// ============================================================
// COMPLAINT SERVICE
// ============================================================
export const ComplaintService = {
    async createComplaint(data) {
        const p = await profile();
        const refNum = genRef('CMP-');
        let upload = null;
        if (data.evidenceFile) {
            upload = await uploadFile(`complaints/${p.id}/${refNum}`, data.evidenceFile);
        }

        // Firebase Storage is unavailable on Spark projects created under the
        // current billing policy. In explicitly selected PHP mode, keep the
        // complaint record and local evidence path together in the trusted
        // server action so Firestore Rules do not need to permit arbitrary
        // local URLs from a browser.
        if (usingLocalPhpBackend()) {
            return invokeCallable({
                category: String(data.category || '').trim(),
                description: String(data.description || '').trim(),
                relatedBookingId: String(data.relatedBookingId || '').trim(),
                relatedTicketId: String(data.relatedTicketId || '').trim(),
                evidencePath: upload?.localPath || ''
            }, { name: 'createComplaint' });
        }

        const evidenceUrls = upload ? [upload.url] : [];

        const ref = await addDoc(collection(db, 'Complaints'), {
            referenceNumber: refNum,
            complainantUid: p.id,
            complainantName: p.fullName || '',
            complainantRole: p.role || 'buyer',
            category: data.category,
            description: data.description,
            relatedBookingId: data.relatedBookingId || '',
            relatedTicketId: data.relatedTicketId || '',
            evidenceUrls,
            status: 'OPEN',
            createdAt: iso(),
            updatedAt: iso()
        });

        await AuditService.log('complaint_created', 'complaint', ref.id, { refNum, category: data.category });
        return { id: ref.id, referenceNumber: refNum };
    },

    async getComplaints(filters = {}) {
        const c = [];
        if (filters.complainantUid) c.push(where('complainantUid', '==', filters.complainantUid));
        if (filters.status) c.push(where('status', '==', filters.status));
        const snap = await getDocs(query(collection(db, 'Complaints'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getComplaint(complaintId) {
        const snap = await getDoc(doc(db, 'Complaints', complaintId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async getUserComplaints() {
        return this.getComplaints({ complainantUid: uid() });
    },

    async updateStatus(complaintId, status, note = '') {
        const p = await profile();
        await updateDoc(doc(db, 'Complaints', complaintId), {
            status,
            timeline: arrayUnion({ status, note, actor: p.id, actorRole: p.role, timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('complaint_status_changed', 'complaint', complaintId, { status, note });

        const complaint = await this.getComplaint(complaintId);
        if (complaint) {
            await NotificationService.create(complaint.complainantUid, `Your complaint ${complaint.referenceNumber} status changed to: ${status}`, 'complaint_update', 'complaint', complaintId);
        }
    },

    async resolve(complaintId, action, explanation) {
        const p = await profile();
        await updateDoc(doc(db, 'Complaints', complaintId), {
            status: 'RESOLVED', resolutionAction: action, resolutionExplanation: explanation,
            timeline: arrayUnion({ status: 'RESOLVED', note: `${action}: ${explanation}`, actor: p.id, actorRole: p.role, timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('complaint_resolved', 'complaint', complaintId, { action, explanation });
    },

    async reject(complaintId, reason) {
        const p = await profile();
        await updateDoc(doc(db, 'Complaints', complaintId), {
            status: 'REJECTED', rejectionReason: reason,
            timeline: arrayUnion({ status: 'REJECTED', note: reason, actor: p.id, actorRole: p.role, timestamp: iso() }),
            updatedAt: iso()
        });
        await AuditService.log('complaint_rejected', 'complaint', complaintId, { reason });
    }
};

// ============================================================
// RESALE SERVICE
// ============================================================
export const ResaleService = {
    async createListing(data) {
        const callableConfig = secureFunctionConfig(
            'tsCreateResaleListingFunction', 'createResaleListingFunction', 'createResaleListing'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            const response = await invokeCallable({
                ticketId: String(data.ticketId || '').trim(),
                resalePrice: asAmount(data.resalePrice)
            }, callableConfig);
            if (!response.id) throw new Error('The secure resale service returned no listing ID.');
            return response.id;
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure resale listing is not configured.');
        }

        const p = await profile();
        const ticket = await TicketService.getTicket(data.ticketId);
        if (!ticket) throw new Error('Ticket not found.');
        if (ticket.ownerUid !== p.id) throw new Error('You do not own this ticket.');
        if (ticket.status !== 'VALID') throw new Error('Ticket is not eligible for resale.');

        const ref = await addDoc(collection(db, 'ResaleListings'), {
            ticketId: data.ticketId,
            organizerUid: ticket.organizerUid || '',
            eventId: ticket.eventId,
            eventName: ticket.eventName || '',
            categoryName: ticket.categoryName || '',
            sectionId: ticket.sectionId || '',
            seatId: ticket.seatId || '',
            sellerUid: p.id,
            sellerWallet: ticket.walletAddress || '',
            buyerUid: '',
            buyerWallet: '',
            originalPrice: parseFloat(data.originalPrice) || 0,
            resalePrice: parseFloat(data.resalePrice) || 0,
            maxAllowedPrice: parseFloat(data.maxAllowedPrice) || 0,
            status: 'ACTIVE',
            ruleCompliance: parseFloat(data.resalePrice) <= parseFloat(data.maxAllowedPrice) ? 'COMPLIANT' : 'VIOLATION',
            riskFlag: '',
            createdAt: iso(),
            updatedAt: iso()
        });

        // Update ticket status
        await updateDoc(doc(db, 'NFTTickets', data.ticketId), { status: 'LISTED_FOR_RESALE', updatedAt: iso() });
        await AuditService.log('resale_listing_created', 'resale', ref.id, { ticketId: data.ticketId });
        return ref.id;
    },

    async getListings(filters = {}) {
        const c = [];
        const requestedStatus = String(filters.status || '').trim().toUpperCase();
        if (requestedStatus) c.push(where('status', '==', requestedStatus));

        if (!auth.currentUser) {
            // Anonymous marketplace browsing is intentionally limited to
            // currently active listings, which is the public rule surface.
            if (requestedStatus && requestedStatus !== 'ACTIVE') {
                throw new Error('Sign in to view non-active resale listings.');
            }
            if (!requestedStatus) c.push(where('status', '==', 'ACTIVE'));
        } else {
            const p = await profile();
            if (p.role === 'organizer') {
                if (filters.organizerUid && filters.organizerUid !== p.id) {
                    throw new Error('Organizers can view resale records for their own events only.');
                }
                c.push(where('organizerUid', '==', p.id));
            } else if (p.role !== 'admin') {
                const isPublicActiveQuery = requestedStatus === 'ACTIVE' && !filters.sellerUid;
                if (filters.sellerUid && filters.sellerUid !== p.id && !isPublicActiveQuery) {
                    throw new Error('You can view only your own resale records.');
                }
                if (!filters.sellerUid && !isPublicActiveQuery) {
                    c.push(where('status', '==', 'ACTIVE'));
                }
            }
        }

        if (filters.sellerUid) c.push(where('sellerUid', '==', filters.sellerUid));
        if (filters.organizerUid && auth.currentUser) {
            const p = await profile();
            if (p.role === 'admin') c.push(where('organizerUid', '==', filters.organizerUid));
        }
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        const snap = await getDocs(query(collection(db, 'ResaleListings'), ...c));
        let results = snap.docs.map(d => withResaleAliases({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getActiveListings() {
        return this.getListings({ status: 'ACTIVE' });
    },

    async getListing(listingId) {
        const snap = await getDoc(doc(db, 'ResaleListings', listingId));
        return snap.exists() ? withResaleAliases({ id: snap.id, ...snap.data() }) : null;
    },

    async getUserListings() {
        return this.getListings({ sellerUid: uid() });
    },

    async updatePrice(listingId, newPrice) {
        const callableConfig = secureFunctionConfig(
            'tsUpdateResalePriceFunction', 'updateResalePriceFunction', 'updateResalePrice'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({
                listingId: String(listingId || '').trim(),
                resalePrice: asAmount(newPrice)
            }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure resale repricing is not configured.');
        }

        const listing = await this.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');
        const compliance = newPrice <= listing.maxAllowedPrice ? 'COMPLIANT' : 'VIOLATION';
        await updateDoc(doc(db, 'ResaleListings', listingId), {
            resalePrice: parseFloat(newPrice), ruleCompliance: compliance, updatedAt: iso()
        });
        await AuditService.log('resale_price_updated', 'resale', listingId, { newPrice });
    },

    async cancelListing(listingId) {
        const callableConfig = secureFunctionConfig(
            'tsCancelResaleListingFunction', 'cancelResaleListingFunction', 'cancelResaleListing'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({ listingId: String(listingId || '').trim() }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure resale cancellation is not configured.');
        }

        const listing = await this.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');
        await updateDoc(doc(db, 'ResaleListings', listingId), { status: 'CANCELLED', updatedAt: iso() });
        // Restore ticket status
        await updateDoc(doc(db, 'NFTTickets', listing.ticketId), { status: 'VALID', updatedAt: iso() });
        await AuditService.log('resale_listing_cancelled', 'resale', listingId);
    },

    async suspendListing(listingId, reason) {
        const callableConfig = secureFunctionConfig(
            'tsSuspendResaleListingFunction', 'suspendResaleListingFunction', 'suspendResaleListing'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({
                listingId: String(listingId || '').trim(),
                reason: String(reason || 'Suspended by an administrator.').trim()
            }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure resale moderation is not configured.');
        }

        await updateDoc(doc(db, 'ResaleListings', listingId), {
            status: 'SUSPENDED', riskFlag: reason, updatedAt: iso()
        });
        const listing = await this.getListing(listingId);
        await AuditService.log('resale_listing_suspended', 'resale', listingId, { reason });
        if (listing) {
            await NotificationService.create(listing.sellerUid, `Your resale listing has been suspended: ${reason}`, 'resale_suspended', 'resale', listingId);
        }
    },

    async purchaseListing(listingId) {
        const callableConfig = secureFunctionConfig(
            'tsPurchaseResaleFunction', 'purchaseResaleFunction', 'purchaseResale'
        );
        if (callableConfig && window.tsCheckoutMode !== 'local') {
            return invokeCallable({ listingId: String(listingId || '').trim() }, callableConfig);
        }

        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Secure resale purchase is not configured.');
        }

        const buyer = await profile();
        return this.completeSaleLocally(listingId, buyer.id, buyer.walletAddress || '');
    },

    // Kept as a compatibility alias for older page scripts. A caller can buy
    // only for their own account; the callable Function derives identity from
    // Firebase Auth instead of accepting buyer identity from the browser.
    async completeSale(listingId, buyerUid = '', buyerWallet = '') {
        const currentUserId = uid();
        if (buyerUid && buyerUid !== currentUserId) {
            throw new Error('A resale purchase must be completed by the buyer.');
        }
        if (buyerWallet && !String(buyerWallet).trim()) {
            throw new Error('A wallet is required to purchase a resale ticket.');
        }
        return this.purchaseListing(listingId);
    },

    async completeSaleLocally(listingId, buyerUid, buyerWallet) {
        if (!clientCheckoutFallbackAllowed()) {
            throw new Error('Local resale settlement has been removed. Use the secure resale service.');
        }
        const listing = await this.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');

        await updateDoc(doc(db, 'ResaleListings', listingId), {
            status: 'SOLD', buyerUid, buyerWallet, completedAt: iso(), updatedAt: iso()
        });

        // Transfer ticket ownership
        await updateDoc(doc(db, 'NFTTickets', listing.ticketId), {
            ownerUid: buyerUid, walletAddress: buyerWallet, status: 'VALID',
            transferHistory: arrayUnion({ from: listing.sellerWallet, to: buyerWallet, timestamp: iso() }),
            updatedAt: iso()
        });

        await BlockchainService.logTransaction({
            transactionType: 'RESALE', ticketId: listing.ticketId,
            walletAddress: buyerWallet,
            relatedEntityType: 'resale', relatedEntityId: listingId
        });

        await AuditService.log('resale_completed', 'resale', listingId);
        await NotificationService.create(listing.sellerUid, 'Your resale listing has been sold!', 'resale_sold', 'resale', listingId);
        await NotificationService.create(buyerUid, 'You purchased a resale ticket. NFT ownership is being transferred.', 'resale_purchased', 'resale', listingId);
    }
};

// ============================================================
// BLOCKCHAIN TRANSACTION SERVICE
// ============================================================
export const BlockchainService = {
    async logTransaction(data) {
        throw new Error('Blockchain transaction records are managed by the trusted backend.');

        const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const ref = await addDoc(collection(db, 'BlockchainTransactions'), {
            transactionHash: txHash,
            walletAddress: data.walletAddress || '',
            transactionType: data.transactionType || 'MINT',
            ticketId: data.ticketId || '',
            relatedEntityType: data.relatedEntityType || '',
            relatedEntityId: data.relatedEntityId || '',
            status: 'PENDING',
            network: 'Ethereum (Simulated)',
            failureReason: '',
            timestamp: iso()
        });

        // Simulate blockchain confirmation after a short delay
        setTimeout(async () => {
            try {
                await updateDoc(doc(db, 'BlockchainTransactions', ref.id), { status: 'CONFIRMED' });
                // Update ticket minting status if MINT type
                if (data.transactionType === 'MINT' && data.ticketId) {
                    await TicketService.updateMintingStatus(data.ticketId, 'MINTED', txHash);
                }
            } catch (e) { console.warn('Blockchain simulation update failed:', e); }
        }, 3000);

        return { id: ref.id, transactionHash: txHash };
    },

    async getTransactions(filters = {}) {
        const c = [];
        if (filters.status) c.push(where('status', '==', filters.status));
        if (filters.transactionType) c.push(where('transactionType', '==', filters.transactionType));
        if (filters.ticketId) c.push(where('ticketId', '==', filters.ticketId));
        const snap = await getDocs(query(collection(db, 'BlockchainTransactions'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getTransaction(txId) {
        const snap = await getDoc(doc(db, 'BlockchainTransactions', txId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
};

// ============================================================
// EXPOSE ALL SERVICES GLOBALLY
// ============================================================
window.tsAudit = AuditService;
window.tsNotifications = NotificationService;
window.tsUsers = UserService;
window.tsVenues = VenueService;
window.tsEvents = EventService;
window.tsSeats = SeatService;
window.tsBookings = BookingService;
window.tsTickets = TicketService;
window.tsComplaints = ComplaintService;
window.tsResale = ResaleService;
window.tsBlockchain = BlockchainService;

console.log('TickSecure CRUD services loaded.');
