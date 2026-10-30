(function(){
    'use strict';
    const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className||'';if(text!==undefined)el.textContent=text;return el;};
    const hash=value=>/^0x[0-9a-fA-F]{64}$/.test(String(value||''));
    const confirmed=r=>r.status==='CONFIRMED'&&r.verificationVersion===2;
    function fact(label,value){const group=node('div');group.append(node('dt','',label),node('dd','ts-transfer-code',value||'Not recorded'));return group;}
    function receipt(record){
        const card=node('article','ts-transfer-receipt'),heading=node('div','ts-transfer-receipt-heading'),title=node('div');
        title.append(node('span','ts-transfer-kicker',record.transactionType||'Ticket operation'),node('h2','',record.eventName||record.ticketId||'Ticket'));
        const label=confirmed(record)?'Confirmed on Sepolia':({SUBMITTED:'Waiting for confirmations',FAILED:'Transaction reverted',LEGACY:'Earlier contract',PENDING:'Awaiting wallet approval'}[record.status]||'Pending');
        heading.append(title,node('span','ts-chip ts-chip-'+(confirmed(record)?'success':record.status==='FAILED'?'error':'neutral'),label));card.append(heading);
        const facts=node('dl','ts-transfer-facts');facts.append(fact('Ticket ID',record.ticketId),fact('Category / seat',[record.categoryName,record.seatId].filter(Boolean).join(' / ')),fact('Submitting wallet',record.actorWallet),fact('Receiving wallet',record.walletAddress));card.append(facts);
        if(hash(record.transactionHash)&&record.chainId===11155111){const link=node('a','ts-transfer-code',record.transactionHash);link.href='https://sepolia.etherscan.io/tx/'+record.transactionHash;link.target='_blank';link.rel='noopener noreferrer';card.append(node('small','secondary','Transaction hash'),link);}
        else card.append(node('p','small secondary','A transaction hash will appear after submission.'));
        if(record.confirmations)card.append(node('p','small secondary',record.confirmations+' confirmations'));
        if(record.failureReason)card.append(node('p','small secondary',record.failureReason));
        if(record.blockedReason)card.append(node('p','small secondary',record.blockedReason));
        card.append(node('p','small secondary','Record: '+record.id));
        return card;
    }
    window.tsBlockchainDisplay={node,hash,confirmed,receipt};
})();
