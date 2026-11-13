(function () {
    'use strict';
    const T=window.tsStaffTools, el=id=>document.getElementById(id), kind=el('staff-list-page')?.dataset.kind;
    if(!kind)return;
    const value=id=>el(id)?.value||'', search=()=>value('list-search').trim().toLowerCase();
    const matches=values=>values.join(' ').toLowerCase().includes(search());
    const seatLabel=t=>window.tsTicketDisplay?.seatLabel(t)||t.seatId||'Not assigned';
    const cells=values=>values.map(v=>`<td style="overflow-wrap:anywhere">${T.esc(v??'Not recorded')}</td>`).join('');
    let all=[], complaintStatus='OPEN';
    const priority=c=>['','MEDIUM','NORMAL'].includes(T.norm(c.priority))?'NORMAL':T.norm(c.priority);
    const configs={
        nft:{role:'organizer',columns:7,controls:['list-search','list-event','list-status'],
            load:()=>window.tsTickets.getTickets(),
            loaded(rows){all=rows;T.options(el('list-event'),new Map(rows.filter(t=>t.eventId).map(t=>[t.eventId,t.eventName||t.eventId])),'All events');},
            filter:t=>(!value('list-event')||t.eventId===value('list-event'))&&(!value('list-status')||T.mintStatus(t)===value('list-status'))&&matches([t.id,t.tokenId,t.walletAddress,t.ownerWallet,t.eventName,t.seatId,seatLabel(t)]),
            row:t=>'<tr>'+cells([t.id,[t.eventName||t.eventId,t.categoryName||t.category,seatLabel(t)].filter(Boolean).join(' / '),t.tokenId||'Not minted',t.walletAddress||t.ownerWallet||'Unassigned',T.mintStatus(t),t.transactionHash||'Not submitted'])+`<td><button class="ts-btn ts-btn-secondary ts-btn-sm" type="button" data-details="${T.esc(t.id)}">Details</button></td></tr>`,
            after(rows){el('list-summary').textContent=`${rows.length} tickets · ${rows.filter(t=>T.mintStatus(t)==='MINTED').length} minted · ${rows.filter(t=>T.mintStatus(t)==='PENDING').length} pending · ${rows.filter(t=>T.mintStatus(t)==='FAILED').length} failed`;},
            bind(body){body.querySelectorAll('[data-details]').forEach(b=>b.addEventListener('click',()=>{
                const t=all.find(t=>t.id===b.dataset.details);if(!t)return;
                showDetails('Ticket details',[['Ticket',t.id],['Event',t.eventName||t.eventId],['Booking',t.bookingId],['Category',t.categoryName||t.category],['Seat',seatLabel(t)],['Owner wallet',t.walletAddress||t.ownerWallet],['Token',t.tokenId],['Minting',T.mintStatus(t)],['Ticket status',t.status],['Transaction',t.transactionHash],['Created',T.dateText(t.createdAt)],['Ownership history',JSON.stringify(t.transferHistory||[],null,2)]]);
            }));}
        },
        attendees:{role:'organizer',columns:7,controls:['list-search','list-category','list-status'],
            async load(){const [bookings,tickets]=await Promise.all([window.tsBookings.getBookings(),window.tsTickets.getTickets()]);const byId=new Map(bookings.map(b=>[b.id,b]));return tickets.map(t=>{const b=byId.get(t.bookingId);return {...t,buyer:t.ownerUid===b?.buyerUid?(b.buyerName||t.ownerUid):(t.ownerUid||'Unknown'),category:t.categoryName||t.category||'N/A',wallet:t.walletAddress||t.ownerWallet||'Unassigned'};});},
            loaded(rows){T.options(el('list-category'),rows.map(t=>t.category),'All categories');},
            filter:t=>(!value('list-category')||t.category===value('list-category'))&&(!value('list-status')||(value('list-status')==='USED'?t.status==='USED':t.status!=='USED'))&&matches([t.buyer,t.bookingId,t.id,t.wallet,t.eventName,t.seatId,seatLabel(t)]),
            row:t=>'<tr>'+cells([t.buyer,t.bookingId,t.id,t.category,seatLabel(t),t.wallet,t.status==='USED'?'Verified':`Unverified (${t.status||'unknown'})`])+'</tr>',
            after(rows){const used=rows.filter(t=>t.status==='USED').length;el('list-summary').textContent=`${used} verified · ${rows.length-used} unverified · ${rows.length} tickets`;}
        },
        audit:{role:'admin',columns:7,controls:['list-search','list-role','list-activity','list-date'],exportButton:'list-export',filename:'ticksecure-audit.csv',
            load:()=>window.tsAudit.getLogs(),
            loaded(rows){T.options(el('list-activity'),rows.map(l=>l.action),'All activities');},
            filter:l=>(!value('list-role')||T.norm(l.actorRole)===value('list-role'))&&(!value('list-activity')||l.action===value('list-activity'))&&(!value('list-date')||T.day(l.timestamp||l.createdAt)===value('list-date'))&&matches([l.actorEmail,l.actorUid,l.action,l.entityId,l.actorRole]),
            row:l=>'<tr>'+cells([T.dateText(l.timestamp||l.createdAt),l.actorEmail||l.actorUid||'System',l.actorRole,l.action,l.entityId,l.result])+`<td><button class="ts-btn ts-btn-secondary ts-btn-sm" type="button" data-details="${T.esc(l.id)}">View</button></td></tr>`,
            bind(body,rows){body.querySelectorAll('[data-details]').forEach(b=>b.addEventListener('click',()=>showDetails('Audit details',[['Recorded information',JSON.stringify(rows.find(l=>l.id===b.dataset.details)?.details||{},null,2)]])));},
            csv:rows=>[['Date (Malaysia time)','Actor','Role','Activity','Related entity','Result','Details'],...rows.map(l=>[T.dateText(l.timestamp||l.createdAt),l.actorEmail||l.actorUid,l.actorRole,l.action,l.entityId,l.result,JSON.stringify(l.details||{})])]
        },
        complaints:{role:'admin',columns:8,controls:['list-search','list-priority'],load:()=>window.tsComplaints.getComplaints(),
            setup(render){document.querySelectorAll('[data-complaint-status]').forEach(b=>b.addEventListener('click',()=>{complaintStatus=b.dataset.complaintStatus;document.querySelectorAll('[data-complaint-status]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});render();}));},
            filter:c=>T.norm(c.status||'OPEN')===complaintStatus&&(!value('list-priority')||priority(c)===value('list-priority'))&&matches([c.referenceNumber,c.id,c.complainantName,c.complainantUid,c.category]),
            row:c=>'<tr>'+cells([c.referenceNumber||c.id,c.complainantName||c.complainantUid,c.complainantRole,c.category,priority(c),T.norm(c.status||'OPEN').replaceAll('_',' '),T.dateText(c.createdAt)])+`<td><a class="ts-btn ts-btn-primary ts-btn-sm" href="complaint-detail.php?id=${encodeURIComponent(c.id)}">Investigate</a></td></tr>`
        }
    };
    function showDetails(title,fields) {
        let dialog=el('staff-details');if(!dialog){dialog=document.createElement('dialog');dialog.id='staff-details';dialog.className='ts-card ts-card-pad';dialog.style.cssText='width:min(640px,90vw);max-height:85vh;overflow:auto;border:1px solid #ddd;border-radius:10px';document.body.append(dialog);}
        dialog.innerHTML=`<h2>${T.esc(title)}</h2>`+fields.map(([label,value])=>`<div class="ts-summary-row"><span>${T.esc(label)}</span><strong style="white-space:pre-wrap;overflow-wrap:anywhere;max-width:70%">${T.esc(value||'Not recorded')}</strong></div>`).join('')+'<form method="dialog"><button class="ts-btn ts-btn-primary mt-20">Close</button></form>';
        dialog.showModal();
    }
    T.table({...configs[kind],body:'staff-list-body',clear(){if(el('list-summary'))el('list-summary').textContent='Records unavailable';el('staff-details')?.close();}});
})();
