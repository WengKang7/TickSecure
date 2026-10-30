'use strict';
function transferReceipt(ticket, event, sender, recipient, wallet, timestamp) {
    return {
        ticketId: ticket.id || '', eventId: ticket.eventId || '', eventName: ticket.eventName || event.name || '',
        eventDate: event.date || ticket.eventDate || '', eventTime: event.time || '', venueName: event.venueName || ticket.venueName || '',
        categoryName: ticket.categoryName || '', sectionId: ticket.sectionId || '', seatId: ticket.seatId || '',
        fromName: sender.fullName || sender.displayName || '', toName: recipient.fullName || recipient.displayName || '',
        fromWallet: ticket.walletAddress || '', toWallet: wallet, timestamp
    };
}
async function getTicketTransfers(db, uid, data, fail) {
    const read = async (collection,id) => { const snap=await db.collection(collection).doc(id).get();return snap.exists ? {...snap.data(),id:snap.id} : null; };
    const user=await read('Users',uid);
    if (user?.role!=='buyer' || user.status!=='active' || user.emailVerified!==true) fail('permission-denied','An active, verified buyer account is required.');
    for (const key of ['ticketId','transferId']) if (data[key]!==undefined && (typeof data[key]!=='string' || !/^[A-Za-z0-9_-]{1,160}$/.test(data[key]))) fail('invalid-argument',`${key} is invalid.`);
    let logs;
    if (data.transferId) logs=[await read('AuditLogs',data.transferId)];
    else {
        const snapshots=await Promise.all([db.collection('AuditLogs').where('actorUid','==',uid).get(),db.collection('AuditLogs').where('details.recipientUid','==',uid).get()]);
        logs=snapshots.flatMap(s=>s.docs.map(doc=>({...doc.data(),id:doc.id})));
    }
    const records=new Map(),tickets=new Map(),profiles=new Map(),events=new Map();
    async function cached(cache,collection,id){if(!cache.has(id))cache.set(id,await read(collection,id));return cache.get(id);}
    for(const log of logs){
        if(!log || log.action!=='ticket_transferred' || log.entityType!=='ticket')continue;
        const fromUid=log.actorUid,toUid=log.details?.recipientUid;
        if(!fromUid || !toUid)continue;
        if(fromUid!==uid && toUid!==uid)continue;
        if(data.ticketId && data.ticketId!==log.entityId)continue;
        const ticket=await cached(tickets,'NFTTickets',log.entityId);
        let snapshot=log.details?.transfer;
        const legacy=!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot);
        if(legacy){
            const history=(Array.isArray(ticket?.transferHistory)?ticket.transferHistory:[]).filter(s=>s?.fromUid===fromUid && s?.toUid===toUid);
            const time=Date.parse(log.timestamp)||0;
            history.sort((a,b)=>Math.abs((Date.parse(a.timestamp)||0)-time)-Math.abs((Date.parse(b.timestamp)||0)-time));
            const step=history[0]||{};
            const [sender,recipient,event]=await Promise.all([cached(profiles,'Users',fromUid),cached(profiles,'Users',toUid),ticket?.eventId?cached(events,'Events',ticket.eventId):{}]);
            snapshot=transferReceipt({...ticket,id:log.entityId,walletAddress:step.fromWallet||''},event||{},sender||{},recipient||{},step.toWallet||'',log.timestamp||'');
        }
        const safe={};
        for(const key of ['ticketId','eventId','eventName','eventDate','eventTime','venueName','categoryName','sectionId','seatId','fromName','toName','fromWallet','toWallet','timestamp'])safe[key]=typeof snapshot[key]==='string'?snapshot[key]:'';
        records.set(log.id,{...safe,id:log.id,direction:fromUid===uid?'SENT':'RECEIVED',status:'COMPLETED',isCurrentOwner:ticket?.ownerUid===uid,legacy});
    }
    if(data.transferId && !records.size)fail('not-found','Transfer record not found for your account.');
    return {records:[...records.values()].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)||b.id.localeCompare(a.id))};
}
module.exports={transferReceipt,getTicketTransfers};
