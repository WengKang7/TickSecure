(function () {
    'use strict';
    const el=id=>document.getElementById(id),params=new URLSearchParams(window.location.search),ticketId=params.get('ticketId')||'';
    let ticket=null,version=0,busy=false;
    const error=message=>{el('transfer-error').textContent=message||'';el('transfer-error').hidden=!message;};
    window.addEventListener('ts-auth-ready',async()=>{
        const current=++version,uid=window.tsCurrentUser?.uid;ticket=null;busy=false;
        el('transfer-form').hidden=true;el('transfer-ticket-summary').hidden=true;el('btn-submit').disabled=true;error('');
        if(!uid)return;
        try{
            if(!/^[A-Za-z0-9_-]{1,160}$/.test(ticketId))throw Error('Choose a ticket from My Tickets to start a transfer.');
            const record=await window.tsTickets.getTicket(ticketId);
            if(current!==version || uid!==window.tsCurrentUser?.uid)return;
            if(!record || record.ownerUid!==uid)throw Error('This ticket is no longer in your account. Your transfer records are shown below.');
            if(record.status!=='VALID')throw Error('Only a valid, unused ticket can be transferred. Your transfer records are shown below.');
            let event=null;
            try{event=record.eventId?await window.tsEvents.getEvent(record.eventId):null;}catch(_){}
            if(current!==version || uid!==window.tsCurrentUser?.uid)return;
            ticket={...record,id:ticketId};
            el('transfer-desc').textContent='Review your ticket and the recipient wallet before confirming the transfer.';
            el('transfer-event-name').textContent=ticket.eventName||event?.name||'Event';
            el('transfer-event-date').textContent=window.tsTicketDisplay.eventDate(ticket,event);
            el('transfer-venue').textContent=event?.venueName||ticket.venueName||'Venue not recorded';
            el('transfer-category').textContent=ticket.categoryName||'Not recorded';
            el('transfer-seat').textContent=[ticket.sectionId,ticket.seatId].filter(Boolean).join(' / ')||'Not assigned';
            el('transfer-ticket-id').textContent=ticketId;
            el('transfer-sender-name').textContent=window.tsCurrentUser.fullName||window.tsCurrentUser.displayName||'Your account';
            el('transfer-sender-wallet').textContent=ticket.walletAddress||window.tsCurrentUser.walletAddress||'Not recorded';
            el('btn-cancel').href='ticket-detail.php?id='+encodeURIComponent(ticketId);
            el('transfer-ticket-summary').hidden=false;
            if(event && (event.status!=='PUBLISHED'||event.transferEnabled===false))throw Error('Transfers are not enabled for this event.');
            el('transfer-form').hidden=false;el('btn-submit').disabled=false;
        }catch(failure){if(current===version)error(failure.code==='permission-denied'?'This ticket is no longer available in your account. Check your transfer records below.':failure.message);}
    });
    el('btn-submit').addEventListener('click',async event=>{
        event.preventDefault();if(busy||!ticket||el('btn-submit').disabled)return;
        const form=el('transfer-form'),V=window.tsValidation;
        V.clearFieldErrors(form);error('');
        const recipient=V.val(form,'recipientWallet').trim();
        if(!V.runAll([{check:()=>V.validateRequired(recipient,'Recipient wallet'),el:V.el(form,'recipientWallet')},
            {check:()=>V.validateWalletAddress(recipient),el:V.el(form,'recipientWallet')}]))return;
        const current=version,uid=window.tsCurrentUser?.uid;busy=true;el('btn-submit').disabled=true;
        try{
            if(!await window.tsDecision('transferTicket',ticket.eventName||'Ticket',[
                ['Sender',el('transfer-sender-name').textContent],['Ticket',ticket.id],['Category',ticket.categoryName||'Not recorded'],
                ['Seat',ticket.seatId||'Not assigned'],['Recipient wallet',recipient]]))return;
            if(current!==version||uid!==window.tsCurrentUser?.uid)return;
            el('btn-submit').textContent='Transferring...';
            const result=await window.tsTickets.transferTicket(ticket.id,recipient);
            if(current!==version||uid!==window.tsCurrentUser?.uid)return;
            window.location.href=result.blockchainRecordId?'blockchain.php?recordId='+encodeURIComponent(result.blockchainRecordId)+(result.transferId?'&transferId='+encodeURIComponent(result.transferId):'')
                :'ticket-transfers.php?'+(result.transferId?'transferId='+encodeURIComponent(result.transferId):'ticketId='+encodeURIComponent(ticket.id));
        }catch(failure){if(current===version)error(/^internal$/i.test(failure.message||'')?'The transfer service could not complete the request. Refresh this page and try again.':failure.message);}
        finally{if(current===version){busy=false;el('btn-submit').disabled=false;el('btn-submit').textContent='Review transfer';}}
    });
})();
