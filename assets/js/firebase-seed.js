import { db, auth } from './firebase-init.js';
import { doc, setDoc, getDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * TickSecure — Comprehensive Database Seed
 * Seeds all 12 collections with representative sample data.
 * Run from browser console: window.tsSeedDatabase()
 */

const iso = (daysOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString();
}

async function getOrCreateUser(email, password) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        return cred.user.uid;
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                return cred.user.uid;
            } catch (err) {
                console.warn(`Sign-in failed for ${email}. Creating a unique backup account...`);
                // Create a unique email to guarantee the seed script can proceed
                const uniqueEmail = email.replace('@', `_${Date.now()}@`);
                const backupCred = await createUserWithEmailAndPassword(auth, uniqueEmail, password);
                return backupCred.user.uid;
            }
        }
        console.warn('User creation error:', e.message);
        throw e;
    }
}

export const seedDatabase = async () => {
    console.log("Starting comprehensive database seed...");

    try {
        // ────────────────────────────────────────────────────
        // 1. ADMIN USER
        // ────────────────────────────────────────────────────
        const adminUid = await getOrCreateUser('admin@ticksecure.com', 'Admin@123');
        await setDoc(doc(db, "Users", adminUid), {
            email: "admin@ticksecure.com", fullName: "System Administrator",
            role: "admin", status: "active", createdAt: iso(-30), updatedAt: iso(-30)
        });

        // ────────────────────────────────────────────────────
        // 2. BUYER USER
        // ────────────────────────────────────────────────────
        const buyerUid = await getOrCreateUser('buyer@ticksecure.com', 'Buyer@123');
        await setDoc(doc(db, "Users", buyerUid), {
            email: "buyer@ticksecure.com", fullName: "Grace Hopper",
            role: "buyer", status: "active", walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            createdAt: iso(-20), updatedAt: iso(-20)
        });

        // ────────────────────────────────────────────────────
        // 3. ORGANIZER USER
        // ────────────────────────────────────────────────────
        const organizerUid = await getOrCreateUser('organizer@ticksecure.com', 'Organizer@123');
        await setDoc(doc(db, "Users", organizerUid), {
            email: "organizer@ticksecure.com", fullName: "Nova Stage",
            role: "organizer", status: "active", createdAt: iso(-25), updatedAt: iso(-25)
        });
        await setDoc(doc(db, "OrganizerProfiles", organizerUid), {
            organizationName: "Nova Stage Entertainment",
            organizationDescription: "Premier concert and live event organizer in Southeast Asia.",
            organizationPhone: "+60123456789",
            organizationAddress: "Level 18, Menara TickSecure, Kuala Lumpur"
        });

        // ────────────────────────────────────────────────────
        // 4. PENDING ORGANIZER
        // ────────────────────────────────────────────────────
        const pendingUid = await getOrCreateUser('pending@ticksecure.com', 'Pending@123');
        await setDoc(doc(db, "Users", pendingUid), {
            email: "pending@ticksecure.com", fullName: "Aria Events",
            role: "organizer", status: "pending", createdAt: iso(-3), updatedAt: iso(-3)
        });
        await setDoc(doc(db, "OrganizerProfiles", pendingUid), {
            organizationName: "Aria Events Sdn Bhd",
            organizationDescription: "Boutique event management company specialising in intimate concert experiences.",
            organizationPhone: "+60198765432",
            organizationAddress: "Suite 12A, The Gardens, Mid Valley City"
        });

        // ────────────────────────────────────────────────────
        // 4. VENUES (same as before, but enhanced)
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "Venues", "merdeka-hall"), {
            name: "Merdeka Hall", address: "Kuala Lumpur",
            layoutStatus: "ACTIVE", capacity: 120, blueprintUrl: "",
            createdAt: iso(-60), updatedAt: iso(-30), createdBy: adminUid,
            sections: [
                { sectionId: "A", name: "Section A", seatCount: 20, geometry: { left: 8, top: 28, width: 35, height: 25 } },
                { sectionId: "B", name: "Section B", seatCount: 40, geometry: { left: 57, top: 28, width: 35, height: 25 } },
                { sectionId: "C", name: "Section C", seatCount: 60, geometry: { left: 18, top: 65, width: 64, height: 25 } }
            ]
        });

        await setDoc(doc(db, "Venues", "axiata-arena"), {
            name: "Axiata Arena", address: "Bukit Jalil",
            layoutStatus: "ACTIVE", capacity: 110, blueprintUrl: "",
            createdAt: iso(-50), updatedAt: iso(-25), createdBy: adminUid,
            sections: [
                { sectionId: "A", name: "Lower Left", seatCount: 30, geometry: { left: 6, top: 30, width: 27, height: 30 } },
                { sectionId: "B", name: "Floor", seatCount: 50, geometry: { left: 36, top: 30, width: 28, height: 45 } },
                { sectionId: "C", name: "Lower Right", seatCount: 30, geometry: { left: 67, top: 30, width: 27, height: 30 } }
            ]
        });

        // ────────────────────────────────────────────────────
        // 5. SEATS for Merdeka Hall
        // ────────────────────────────────────────────────────
        const merdekaSections = [
            { id: 'A', count: 20 }, { id: 'B', count: 40 }, { id: 'C', count: 60 }
        ];
        for (const sec of merdekaSections) {
            for (let i = 1; i <= sec.count; i++) {
                const label = `${sec.id}${String(i).padStart(2, '0')}`;
                const status = (sec.id === 'A' && i <= 2) ? 'SOLD' : 'AVAILABLE';
                await setDoc(doc(db, "Seats", `merdeka-hall_${label}`), {
                    venueId: 'merdeka-hall', sectionId: sec.id,
                    seatLabel: label, status,
                    bookingId: status === 'SOLD' ? 'booking-seed-001' : '',
                    createdAt: iso(-30)
                });
            }
        }

        // ────────────────────────────────────────────────────
        // 6. EVENTS
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "Events", "aurora-after-dark"), {
            name: "Aurora After Dark", description: "An ethereal night of electronic music and visual art, featuring international DJs and immersive light installations.",
            eventCategory: "Concert", date: "2026-10-18", time: "20:00",
            venueId: "merdeka-hall", venueName: "Merdeka Hall", venueLocation: "Kuala Lumpur",
            organizerUid: organizerUid, organizerName: "Nova Stage Entertainment",
            status: "PUBLISHED", posterUrl: "", startingPrice: "RM288", availability: "Available",
            maxTicketsPerBuyer: 4,
            salesStartDate: "2026-09-01T10:00", salesEndDate: "2026-10-18T18:00",
            transferEnabled: true, resaleEnabled: true,
            resaleStartDate: "2026-09-15T00:00", resaleDeadline: "2026-10-17T18:00",
            maxResalePrice: 756,
            categories: {
                "A": { name: "VIP1", price: 688, quantity: 20 },
                "B": { name: "CAT1", price: 488, quantity: 40 },
                "C": { name: "CAT2", price: 288, quantity: 60 }
            },
            statusHistory: [
                { from: "", to: "DRAFT", changedBy: organizerUid, timestamp: iso(-15) },
                { from: "DRAFT", to: "PENDING_REVIEW", changedBy: organizerUid, timestamp: iso(-14) },
                { from: "PENDING_REVIEW", to: "PUBLISHED", changedBy: adminUid, timestamp: iso(-13) }
            ],
            createdAt: iso(-15), updatedAt: iso(-13)
        });

        await setDoc(doc(db, "Events", "midnight-resonance"), {
            name: "Midnight Resonance", description: "An unforgettable acoustic concert under the stars.",
            eventCategory: "Live Performance", date: "2026-11-22", time: "21:00",
            venueId: "axiata-arena", venueName: "Axiata Arena", venueLocation: "Bukit Jalil",
            organizerUid: organizerUid, organizerName: "Nova Stage Entertainment",
            status: "PUBLISHED", posterUrl: "", startingPrice: "RM188", availability: "Available",
            maxTicketsPerBuyer: 6,
            salesStartDate: "2026-10-01T10:00", salesEndDate: "2026-11-22T18:00",
            transferEnabled: true, resaleEnabled: true,
            resaleStartDate: "2026-10-15T00:00", resaleDeadline: "2026-11-21T18:00",
            maxResalePrice: 570,
            categories: {
                "A": { name: "VIP1", price: 518, quantity: 30 },
                "B": { name: "VIP2", price: 388, quantity: 50 },
                "C": { name: "CAT1", price: 188, quantity: 30 }
            },
            statusHistory: [
                { from: "", to: "DRAFT", changedBy: organizerUid, timestamp: iso(-10) },
                { from: "DRAFT", to: "PENDING_REVIEW", changedBy: organizerUid, timestamp: iso(-9) },
                { from: "PENDING_REVIEW", to: "PUBLISHED", changedBy: adminUid, timestamp: iso(-8) }
            ],
            createdAt: iso(-10), updatedAt: iso(-8)
        });

        // Draft event for organizer demo
        await setDoc(doc(db, "Events", "draft-event-001"), {
            name: "Neon Pulse", description: "Draft event — not yet submitted.",
            eventCategory: "Festival", date: "2027-01-15", time: "19:00",
            venueId: "merdeka-hall", venueName: "Merdeka Hall", venueLocation: "Kuala Lumpur",
            organizerUid: organizerUid, organizerName: "Nova Stage Entertainment",
            status: "DRAFT", posterUrl: "", startingPrice: "", availability: "Not Published",
            maxTicketsPerBuyer: 4, salesStartDate: "", salesEndDate: "",
            transferEnabled: true, resaleEnabled: false,
            resaleStartDate: "", resaleDeadline: "", maxResalePrice: 0,
            categories: {},
            statusHistory: [{ from: "", to: "DRAFT", changedBy: organizerUid, timestamp: iso(-2) }],
            createdAt: iso(-2), updatedAt: iso(-2)
        });

        // ────────────────────────────────────────────────────
        // 7. BOOKINGS
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "Bookings", "booking-seed-001"), {
            bookingNumber: "TS20260001", buyerUid: buyerUid, buyerName: "Grace Hopper",
            eventId: "aurora-after-dark", eventName: "Aurora After Dark",
            categoryName: "VIP1", sectionId: "A", seats: ["A01", "A02"], quantity: 2,
            unitPrice: 688, serviceCharge: 40, totalAmount: 1416,
            status: "CONFIRMED", paymentStatus: "PAID",
            walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            createdAt: iso(-10), updatedAt: iso(-10)
        });

        await setDoc(doc(db, "Bookings", "booking-seed-002"), {
            bookingNumber: "TS20260002", buyerUid: buyerUid, buyerName: "Grace Hopper",
            eventId: "midnight-resonance", eventName: "Midnight Resonance",
            categoryName: "VIP2", sectionId: "B", seats: ["B04"], quantity: 1,
            unitPrice: 388, serviceCharge: 20, totalAmount: 408,
            status: "CONFIRMED", paymentStatus: "PAID",
            walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            createdAt: iso(-5), updatedAt: iso(-5)
        });

        // ────────────────────────────────────────────────────
        // 8. NFT TICKETS
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "NFTTickets", "TS-TK-0001"), {
            bookingId: "booking-seed-001", eventId: "aurora-after-dark", eventName: "Aurora After Dark",
            categoryName: "VIP1", sectionId: "A", seatId: "A01",
            ownerUid: buyerUid, walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            tokenId: "1001", status: "VALID", mintingStatus: "MINTED",
            transactionHash: "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
            qrData: "TKSECURE:TS-TK-0001:aurora-after-dark:A01",
            usedAt: "", transferHistory: [], createdAt: iso(-10), updatedAt: iso(-10)
        });

        await setDoc(doc(db, "NFTTickets", "TS-TK-0002"), {
            bookingId: "booking-seed-001", eventId: "aurora-after-dark", eventName: "Aurora After Dark",
            categoryName: "VIP1", sectionId: "A", seatId: "A02",
            ownerUid: buyerUid, walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            tokenId: "1002", status: "VALID", mintingStatus: "MINTED",
            transactionHash: "0xb2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567",
            qrData: "TKSECURE:TS-TK-0002:aurora-after-dark:A02",
            usedAt: "", transferHistory: [], createdAt: iso(-10), updatedAt: iso(-10)
        });

        await setDoc(doc(db, "NFTTickets", "TS-TK-0048"), {
            bookingId: "booking-seed-002", eventId: "midnight-resonance", eventName: "Midnight Resonance",
            categoryName: "VIP2", sectionId: "B", seatId: "B04",
            ownerUid: buyerUid, walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            tokenId: "1048", status: "VALID", mintingStatus: "MINTED",
            transactionHash: "0xc3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678",
            qrData: "TKSECURE:TS-TK-0048:midnight-resonance:B04",
            usedAt: "", transferHistory: [], createdAt: iso(-5), updatedAt: iso(-5)
        });

        // ────────────────────────────────────────────────────
        // 9. COMPLAINTS
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "Complaints", "complaint-seed-001"), {
            referenceNumber: "CMP-001", complainantUid: buyerUid, complainantName: "Grace Hopper",
            complainantRole: "buyer", category: "Payment issue",
            description: "I was charged twice for booking TS20260001. My bank statement shows two identical charges of RM1,416.",
            relatedBookingId: "booking-seed-001", relatedTicketId: "", evidenceUrls: [],
            priority: "HIGH", status: "UNDER_INVESTIGATION",
            timeline: [
                { status: "OPEN", note: "Complaint submitted", actor: buyerUid, actorRole: "buyer", timestamp: iso(-7) },
                { status: "UNDER_INVESTIGATION", note: "Admin is reviewing payment records", actor: adminUid, actorRole: "admin", timestamp: iso(-5) }
            ],
            resolutionAction: "", resolutionExplanation: "", rejectionReason: "",
            createdAt: iso(-7), updatedAt: iso(-5)
        });

        await setDoc(doc(db, "Complaints", "complaint-seed-002"), {
            referenceNumber: "CMP-002", complainantUid: buyerUid, complainantName: "Grace Hopper",
            complainantRole: "buyer", category: "Refund request",
            description: "Event was postponed and I need a refund for my tickets.",
            relatedBookingId: "booking-seed-002", relatedTicketId: "", evidenceUrls: [],
            priority: "MEDIUM", status: "OPEN",
            timeline: [
                { status: "OPEN", note: "Complaint submitted", actor: buyerUid, actorRole: "buyer", timestamp: iso(-2) }
            ],
            resolutionAction: "", resolutionExplanation: "", rejectionReason: "",
            createdAt: iso(-2), updatedAt: iso(-2)
        });

        // ────────────────────────────────────────────────────
        // 10. RESALE LISTINGS
        // ────────────────────────────────────────────────────
        await setDoc(doc(db, "ResaleListings", "resale-seed-001"), {
            ticketId: "TS-TK-0048", eventId: "midnight-resonance", eventName: "Midnight Resonance",
            categoryName: "VIP2", seatId: "B04",
            sellerUid: buyerUid, sellerWallet: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892",
            buyerUid: "", buyerWallet: "",
            originalPrice: 388, resalePrice: 420, maxAllowedPrice: 570,
            status: "ACTIVE", ruleCompliance: "COMPLIANT", riskFlag: "",
            createdAt: iso(-3), updatedAt: iso(-3)
        });

        // ────────────────────────────────────────────────────
        // 11. NOTIFICATIONS
        // ────────────────────────────────────────────────────
        const notifs = [
            { recipientUid: buyerUid, message: "Booking TS20260001 confirmed! Your VIP1 tickets for Aurora After Dark are ready.", type: "booking_confirmed", read: true, createdAt: iso(-10) },
            { recipientUid: buyerUid, message: "Your NFT tickets for Aurora After Dark have been minted successfully.", type: "nft_minted", read: true, createdAt: iso(-10) },
            { recipientUid: buyerUid, message: "Booking TS20260002 confirmed for Midnight Resonance.", type: "booking_confirmed", read: false, createdAt: iso(-5) },
            { recipientUid: buyerUid, message: "Your complaint CMP-001 is now Under Investigation.", type: "complaint_update", read: false, createdAt: iso(-5) },
            { recipientUid: organizerUid, message: "Your event 'Aurora After Dark' has been approved and published!", type: "event_approved", read: true, createdAt: iso(-13) },
            { recipientUid: organizerUid, message: "Your event 'Midnight Resonance' has been approved and published!", type: "event_approved", read: true, createdAt: iso(-8) },
            { recipientUid: organizerUid, message: "New booking received for Aurora After Dark: TS20260001", type: "booking_received", read: false, createdAt: iso(-10) }
        ];
        for (let i = 0; i < notifs.length; i++) {
            await setDoc(doc(db, "Notifications", `notif-seed-${String(i+1).padStart(3,'0')}`), {
                ...notifs[i], relatedEntityType: "", relatedEntityId: ""
            });
        }

        // ────────────────────────────────────────────────────
        // 12. AUDIT LOGS
        // ────────────────────────────────────────────────────
        const auditEntries = [
            { action: "organizer_approved", entityType: "user", entityId: organizerUid, actorUid: adminUid, actorEmail: "admin@ticksecure.com", actorRole: "admin", timestamp: iso(-25) },
            { action: "event_created", entityType: "event", entityId: "aurora-after-dark", actorUid: organizerUid, actorEmail: "organizer@ticksecure.com", actorRole: "organizer", timestamp: iso(-15) },
            { action: "event_approved", entityType: "event", entityId: "aurora-after-dark", actorUid: adminUid, actorEmail: "admin@ticksecure.com", actorRole: "admin", timestamp: iso(-13) },
            { action: "booking_created", entityType: "booking", entityId: "booking-seed-001", actorUid: buyerUid, actorEmail: "buyer@ticksecure.com", actorRole: "buyer", timestamp: iso(-10) },
            { action: "venue_layout_activated", entityType: "venue", entityId: "merdeka-hall", actorUid: adminUid, actorEmail: "admin@ticksecure.com", actorRole: "admin", timestamp: iso(-30) }
        ];
        for (let i = 0; i < auditEntries.length; i++) {
            await setDoc(doc(db, "AuditLogs", `audit-seed-${String(i+1).padStart(3,'0')}`), {
                ...auditEntries[i], details: {}, result: "success"
            });
        }

        // ────────────────────────────────────────────────────
        // 13. BLOCKCHAIN TRANSACTIONS
        // ────────────────────────────────────────────────────
        const txns = [
            { transactionHash: "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456", walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892", transactionType: "MINT", ticketId: "TS-TK-0001", status: "CONFIRMED", timestamp: iso(-10) },
            { transactionHash: "0xb2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567", walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892", transactionType: "MINT", ticketId: "TS-TK-0002", status: "CONFIRMED", timestamp: iso(-10) },
            { transactionHash: "0xc3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678", walletAddress: "0x12A4B6C8D0E2F4A6B8C0D2E4F6A8B0C2D4E6F892", transactionType: "MINT", ticketId: "TS-TK-0048", status: "CONFIRMED", timestamp: iso(-5) }
        ];
        for (let i = 0; i < txns.length; i++) {
            await setDoc(doc(db, "BlockchainTransactions", `tx-seed-${String(i+1).padStart(3,'0')}`), {
                ...txns[i], relatedEntityType: "booking", relatedEntityId: "",
                network: "Ethereum (Simulated)", failureReason: ""
            });
        }

        console.log("✅ Database seed completed successfully!");
        console.log("   Test accounts created:");
        console.log("   Admin:     admin@ticksecure.com     / Admin@123");
        console.log("   Organizer: organizer@ticksecure.com / Organizer@123");
        console.log("   Buyer:     buyer@ticksecure.com     / Buyer@123");
        console.log("   Pending:   pending@ticksecure.com   / Pending@123");

    } catch (error) {
        console.error("❌ Error seeding database:", error);
    }
};

window.tsSeedDatabase = seedDatabase;
