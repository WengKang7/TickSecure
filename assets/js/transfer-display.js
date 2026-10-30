(function () {
    'use strict';
    const node = (tag, className, text) => { const el=document.createElement(tag);el.className=className||'';if(text!==undefined)el.textContent=text;return el; };
    const name = value => String(value || '').trim() || 'Name not recorded';
    const date = value => window.tsTicketDisplay.date(value) + (value ? ' (UTC+8)' : '');
    function fact(label,value,code=false) {
        const group=node('div');group.append(node('dt','',label),node('dd',code?'ts-transfer-code':'',value||'Not recorded'));return group;
    }
    function person(label,personName,wallet,you) {
        const card=node('section','ts-transfer-person');
        card.append(node('small','ts-transfer-kicker',label));
        const row=node('div','ts-transfer-person-title'),initial=node('span','ts-transfer-avatar',name(personName).slice(0,1).toUpperCase());
        initial.setAttribute('aria-hidden','true');row.append(initial,node('strong','',name(personName)));
        if(you)row.append(node('span','ts-chip ts-chip-neutral','You'));
        card.append(row,node('div','ts-transfer-code',wallet||'Wallet not recorded'));return card;
    }
    function receipt(record) {
        const sent=record.direction==='SENT',card=node('article','ts-transfer-receipt');
        const header=node('header','ts-transfer-receipt-heading'),title=node('div');
        title.append(node('span','ts-transfer-kicker',sent?'Sent ticket':'Received ticket'),node('h2','',record.eventName||'Ticket transfer'));
        header.append(title,node('span','ts-chip ts-chip-success','Completed'));
        card.append(header,node('p','ts-transfer-time',date(record.timestamp)));
        const people=node('div','ts-transfer-people');
        people.append(person('Sender',record.fromName,record.fromWallet,sent),node('span','ts-transfer-arrow','\u2192'),person('Receiver',record.toName,record.toWallet,!sent));
        card.append(people);
        const facts=node('dl','ts-transfer-facts');
        facts.append(fact('Category',record.categoryName),fact('Section / seat',[record.sectionId,record.seatId].filter(Boolean).join(' / ')),
            fact('Event date',record.eventDate?window.tsTicketDisplay.eventDate(record,{date:record.eventDate,time:record.eventTime}):''),fact('Venue',record.venueName));
        card.append(facts);
        const refs=node('dl','ts-transfer-references');refs.append(fact('Transfer reference',record.id,true),fact('Ticket ID',record.ticketId,true));card.append(refs);
        const footer=node('footer','ts-transfer-receipt-footer');
        footer.append(node('p','small secondary',record.isCurrentOwner?'This ticket is currently in your account.':'This is your transfer receipt, not an entry ticket.'));
        if(record.isCurrentOwner){const link=node('a','ts-btn ts-btn-secondary','View ticket');link.href='ticket-detail.php?id='+encodeURIComponent(record.ticketId);footer.append(link);}
        card.append(footer);
        if(record.legacy)card.append(node('p','small secondary ts-transfer-legacy','Older record: account names reflect current profiles; some event details may be unavailable.'));
        return card;
    }
    window.tsTransferDisplay={receipt,date,name};
})();
