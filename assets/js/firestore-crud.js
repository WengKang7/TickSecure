/**
 * TickSecure — Firestore CRUD Services
 * Central service layer for all Firestore operations, organized by entity.
 * Exposed globally as window.ts<ServiceName> for use by page scripts.
 */
import { db, auth, storage } from './firebase-init.js';
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
function genRef(prefix) { return `${prefix}${Date.now().toString(36).toUpperCase()}`; }

async function uploadFile(path, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await fetch('/ticksecure-ui/api/upload.php', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Local upload failed with status ' + response.status);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    return data.url;
}

// ============================================================
// AUDIT SERVICE — immutable system log
// ============================================================
export const AuditService = {
    async log(action, entityType, entityId = '', details = {}) {
        try {
            const p = await profile();
            await addDoc(collection(db, 'AuditLogs'), {
                action, entityType, entityId,
                actorUid: p.id, actorEmail: p.email || '', actorRole: p.role || '',
                details, result: 'success', timestamp: iso()
            });
        } catch (e) { console.warn('Audit log failed:', e.message); }
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
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        const url = await uploadFile(`venues/${venueId}/blueprint_${Date.now()}`, file);
        await updateDoc(doc(db, 'Venues', venueId), { blueprintUrl: url, updatedAt: iso() });
        await updateDoc(doc(db, 'Venues', venueId), { 
            blueprintUrl: url, 
            blueprintName: file.name,
            blueprintSize: file.size,
            updatedAt: iso() 
        });
        return url;
    },

    async updateSections(venueId, sections) {
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

        // Generate seat records
        const batch = writeBatch(db);
        for (const section of venue.sections) {
            for (let i = 1; i <= section.seatCount; i++) {
                const label = `${section.sectionId}${String(i).padStart(2, '0')}`;
                const seatRef = doc(db, 'Seats', `${venueId}_${label}`);
                batch.set(seatRef, {
                    venueId, sectionId: section.sectionId,
                    seatLabel: label, status: 'AVAILABLE',
                    createdAt: iso()
                });
            }
        }
        batch.update(doc(db, 'Venues', venueId), { layoutStatus: 'ACTIVE', updatedAt: iso() });
        await batch.commit();
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
        const url = await uploadFile(`events/${eventId}/poster_${Date.now()}`, file);
        await updateDoc(doc(db, 'Events', eventId), { posterUrl: url, updatedAt: iso() });
        return url;
    },

    async updateCategories(eventId, categories) {
        // categories: { sectionId: { name, price, quantity } }
        const prices = Object.values(categories).map(c => parseFloat(c.price));
        const startingPrice = prices.length ? `RM${Math.min(...prices)}` : '';
        await updateDoc(doc(db, 'Events', eventId), { categories, startingPrice, updatedAt: iso() });
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
    async getSeats(venueId, sectionId = null) {
        const c = [where('venueId', '==', venueId)];
        if (sectionId) c.push(where('sectionId', '==', sectionId));
        const snap = await getDocs(query(collection(db, 'Seats'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (a.seatLabel || '').localeCompare(b.seatLabel || ''));
        
        return results;
    },

    async getAvailableSeats(venueId, sectionId, count) {
        const snap = await getDocs(query(
            collection(db, 'Seats'),
            where('venueId', '==', venueId),
            where('sectionId', '==', sectionId),
            where('status', '==', 'AVAILABLE'),
            orderBy('seatLabel', 'asc'),
            limit(count)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async reserveSeats(seatIds, expiryMinutes = 10) {
        const u = uid();
        const expiry = new Date(Date.now() + expiryMinutes * 60000).toISOString();
        const batch = writeBatch(db);
        seatIds.forEach(id => {
            batch.update(doc(db, 'Seats', id), {
                status: 'RESERVED', reservedBy: u, reservedAt: iso(), reservationExpiry: expiry
            });
        });
        await batch.commit();
        return expiry;
    },

    async confirmSeats(seatIds, bookingId) {
        const batch = writeBatch(db);
        seatIds.forEach(id => {
            batch.update(doc(db, 'Seats', id), {
                status: 'SOLD', bookingId, reservationExpiry: ''
            });
        });
        await batch.commit();
    },

    async releaseSeats(seatIds) {
        const batch = writeBatch(db);
        seatIds.forEach(id => {
            batch.update(doc(db, 'Seats', id), {
                status: 'AVAILABLE', reservedBy: '', reservedAt: '', reservationExpiry: '', bookingId: ''
            });
        });
        await batch.commit();
    }
};

// ============================================================
// BOOKING SERVICE
// ============================================================
export const BookingService = {
    async createBooking(data) {
        const p = await profile();
        const bookingNumber = genRef('TS');
        const ref = await addDoc(collection(db, 'Bookings'), {
            bookingNumber,
            buyerUid: p.id,
            buyerName: p.fullName || '',
            eventId: data.eventId,
            eventName: data.eventName || '',
            categoryName: data.categoryName,
            sectionId: data.sectionId,
            seats: data.seats || [],
            quantity: parseInt(data.quantity, 10) || 1,
            unitPrice: parseFloat(data.unitPrice) || 0,
            serviceCharge: parseFloat(data.serviceCharge) || 0,
            totalAmount: parseFloat(data.totalAmount) || 0,
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            walletAddress: data.walletAddress || '',
            createdAt: iso(),
            updatedAt: iso()
        });

        // Confirm reserved seats
        if (data.seatDocIds && data.seatDocIds.length) {
            await SeatService.confirmSeats(data.seatDocIds, ref.id);
        }

        // Create NFT tickets for each seat
        for (const seat of (data.seats || [])) {
            await TicketService.createTicket({
                bookingId: ref.id,
                eventId: data.eventId,
                eventName: data.eventName || '',
                categoryName: data.categoryName,
                sectionId: data.sectionId,
                seatId: seat,
                ownerUid: p.id,
                walletAddress: data.walletAddress || ''
            });
        }

        await AuditService.log('booking_created', 'booking', ref.id, { bookingNumber, eventId: data.eventId });
        await NotificationService.create(p.id, `Booking ${bookingNumber} confirmed! Your NFT tickets are being issued.`, 'booking_confirmed', 'booking', ref.id);

        return { id: ref.id, bookingNumber };
    },

    async getBookings(filters = {}) {
        const c = [];
        if (filters.buyerUid) c.push(where('buyerUid', '==', filters.buyerUid));
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        if (filters.status) c.push(where('status', '==', filters.status));
        const snap = await getDocs(query(collection(db, 'Bookings'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getBooking(bookingId) {
        const snap = await getDoc(doc(db, 'Bookings', bookingId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async getUserBookings() {
        return this.getBookings({ buyerUid: uid() });
    },

    async updateStatus(bookingId, status) {
        await updateDoc(doc(db, 'Bookings', bookingId), { status, updatedAt: iso() });
        await AuditService.log('booking_status_changed', 'booking', bookingId, { status });
    }
};

// ============================================================
// TICKET (NFT) SERVICE
// ============================================================
export const TicketService = {
    async createTicket(data) {
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
        if (filters.ownerUid) c.push(where('ownerUid', '==', filters.ownerUid));
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        if (filters.status) c.push(where('status', '==', filters.status));
        if (filters.bookingId) c.push(where('bookingId', '==', filters.bookingId));
        const snap = await getDocs(query(collection(db, 'NFTTickets'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getTicket(ticketId) {
        const snap = await getDoc(doc(db, 'NFTTickets', ticketId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async getUserTickets() {
        return this.getTickets({ ownerUid: uid() });
    },

    async transferTicket(ticketId, recipientWallet) {
        const ticket = await this.getTicket(ticketId);
        if (!ticket) throw new Error('Ticket not found.');
        if (ticket.ownerUid !== uid()) throw new Error('You do not own this ticket.');
        if (ticket.status !== 'VALID') throw new Error('Ticket is not transferable.');

        await updateDoc(doc(db, 'NFTTickets', ticketId), {
            walletAddress: recipientWallet,
            status: 'TRANSFERRED',
            transferHistory: arrayUnion({
                from: ticket.walletAddress, to: recipientWallet,
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
        await NotificationService.create(ticket.ownerUid, `Ticket ${ticketId} has been transferred.`, 'ticket_transferred', 'ticket', ticketId);
        return true;
    },

    async verifyTicket(ticketId, eventId) {
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
        await updateDoc(doc(db, 'NFTTickets', ticketId), { mintingStatus, transactionHash: txHash, updatedAt: iso() });
    }
};

// ============================================================
// COMPLAINT SERVICE
// ============================================================
export const ComplaintService = {
    async createComplaint(data) {
        const p = await profile();
        const refNum = genRef('CMP-');
        let evidenceUrls = [];
        if (data.evidenceFile) {
            const url = await uploadFile(`complaints/${refNum}/${data.evidenceFile.name}`, data.evidenceFile);
            evidenceUrls.push(url);
        }

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
            priority: data.priority || 'MEDIUM',
            status: 'OPEN',
            timeline: [{ status: 'OPEN', note: 'Complaint submitted', actor: p.id, actorRole: p.role, timestamp: iso() }],
            resolutionAction: '',
            resolutionExplanation: '',
            rejectionReason: '',
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
        const p = await profile();
        const ticket = await TicketService.getTicket(data.ticketId);
        if (!ticket) throw new Error('Ticket not found.');
        if (ticket.ownerUid !== p.id) throw new Error('You do not own this ticket.');
        if (ticket.status !== 'VALID') throw new Error('Ticket is not eligible for resale.');

        const ref = await addDoc(collection(db, 'ResaleListings'), {
            ticketId: data.ticketId,
            eventId: ticket.eventId,
            eventName: ticket.eventName || '',
            categoryName: ticket.categoryName || '',
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
        if (filters.status) c.push(where('status', '==', filters.status));
        if (filters.sellerUid) c.push(where('sellerUid', '==', filters.sellerUid));
        if (filters.eventId) c.push(where('eventId', '==', filters.eventId));
        const snap = await getDocs(query(collection(db, 'ResaleListings'), ...c));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (filters.max) results = results.slice(0, filters.max);
        return results;
    },

    async getActiveListings() {
        return this.getListings({ status: 'ACTIVE' });
    },

    async getListing(listingId) {
        const snap = await getDoc(doc(db, 'ResaleListings', listingId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async getUserListings() {
        return this.getListings({ sellerUid: uid() });
    },

    async updatePrice(listingId, newPrice) {
        const listing = await this.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');
        const compliance = newPrice <= listing.maxAllowedPrice ? 'COMPLIANT' : 'VIOLATION';
        await updateDoc(doc(db, 'ResaleListings', listingId), {
            resalePrice: parseFloat(newPrice), ruleCompliance: compliance, updatedAt: iso()
        });
        await AuditService.log('resale_price_updated', 'resale', listingId, { newPrice });
    },

    async cancelListing(listingId) {
        const listing = await this.getListing(listingId);
        if (!listing) throw new Error('Listing not found.');
        await updateDoc(doc(db, 'ResaleListings', listingId), { status: 'CANCELLED', updatedAt: iso() });
        // Restore ticket status
        await updateDoc(doc(db, 'NFTTickets', listing.ticketId), { status: 'VALID', updatedAt: iso() });
        await AuditService.log('resale_listing_cancelled', 'resale', listingId);
    },

    async suspendListing(listingId, reason) {
        await updateDoc(doc(db, 'ResaleListings', listingId), {
            status: 'SUSPENDED', riskFlag: reason, updatedAt: iso()
        });
        const listing = await this.getListing(listingId);
        await AuditService.log('resale_listing_suspended', 'resale', listingId, { reason });
        if (listing) {
            await NotificationService.create(listing.sellerUid, `Your resale listing has been suspended: ${reason}`, 'resale_suspended', 'resale', listingId);
        }
    },

    async completeSale(listingId, buyerUid, buyerWallet) {
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

