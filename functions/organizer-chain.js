'use strict';
const settingsId = uid => 'organizer_' + uid;
const registrationMessage = (projectId, uid, hash = '') =>
    `TickSecure organizer contract registration\nProject: ${projectId}\nOrganizer: ${uid}\nDeployment: ${hash.toLowerCase()}`;
async function read(db, collection, id) {
    const doc = await db.collection(collection).doc(id).get();
    return doc.exists ? doc.data() : null;
}
async function ticketOrganizer(db, ticket, fail) {
    const event = ticket?.eventId ? await read(db, 'Events', ticket.eventId) : null;
    if (!event?.organizerUid || (ticket.organizerUid && ticket.organizerUid !== event.organizerUid))
        fail('failed-precondition', 'The ticket event organizer could not be verified.');
    return event.organizerUid;
}
async function ticketSettings(db, ticket, record, history, fail) {
    const organizerUid = await ticketOrganizer(db, ticket, fail);
    // Existing NFTs cannot move between contracts. Keep confirmed/in-flight
    // legacy tickets on their original contract; never mint new ones there.
    const mint = history.find(row => row.transactionType === 'MINT' && row.verificationVersion === 2 && row.status === 'CONFIRMED');
    const pinned = mint?.contractAddress || (record.status === 'SUBMITTED' && record.transactionHash ? record.contractAddress : '');
    const ownId = settingsId(organizerUid), own = await read(db, 'BlockchainSettings', ownId);
    if (pinned && pinned.toLowerCase() !== own?.contractAddress?.toLowerCase()) {
        const legacy = await read(db, 'BlockchainSettings', 'sepolia');
        if (legacy?.contractAddress?.toLowerCase() === pinned.toLowerCase()) return { config: legacy, settingsId: 'sepolia', organizerUid };
        fail('failed-precondition', 'This ticket needs its original registered contract. Contact the event organizer.');
    }
    return { config: own?.organizerUid === organizerUid ? own : null, settingsId: ownId, organizerUid };
}
module.exports = { settingsId, registrationMessage, ticketOrganizer, ticketSettings };
