(function () {
    'use strict';
    const list=document.getElementById('transfer-history-list');if(!list)return;
    const el=id=>document.getElementById(id),params=new URLSearchParams(window.location.search);
    const request={};if(params.get('ticketId'))request.ticketId=params.get('ticketId');if(params.get('transferId'))request.transferId=params.get('transferId');
    if(el('transfer-ticket-filter'))el('transfer-ticket-filter').hidden=!request.ticketId||Boolean(request.transferId);
    let version=0,records=[],filter='all';
    const tabs=[...document.querySelectorAll('[data-transfer-filter]')];
    function render() {
        const search=(el('transfer-search')?.value||'').trim().toLowerCase();
        const shown=records.filter(r=>(filter==='all'||r.direction===filter)&&[r.eventName,r.fromName,r.toName,r.fromWallet,r.toWallet,r.seatId,r.id].some(v=>String(v||'').toLowerCase().includes(search)));
        list.replaceChildren(...shown.map(window.tsTransferDisplay.receipt));
        el('transfer-history-empty').hidden=shown.length>0;
        el('transfer-history-empty').textContent=records.length?'No transfers match this view.':'No ticket transfers recorded yet.';
        const count=el('transfer-history-count');if(count)count.textContent=`${shown.length} transfer${shown.length===1?'':'s'}`;
        for(const direction of ['SENT','RECEIVED']){const target=el('transfer-count-'+direction.toLowerCase());if(target)target.textContent=String(records.filter(r=>r.direction===direction).length);}
        const receiptNotice=el('transfer-receipt-notice');if(receiptNotice)receiptNotice.hidden=!params.has('transferId')||!records.length;
    }
    async function load() {
        const current=++version,uid=window.tsCurrentUser?.uid;
        records=[];list.replaceChildren();el('transfer-history-error').hidden=true;el('transfer-history-empty').hidden=true;
        if(el('transfer-history-count'))el('transfer-history-count').textContent='';
        el('transfer-history-loading').hidden=!uid;
        if(el('transfer-receipt-notice'))el('transfer-receipt-notice').hidden=true;
        for(const direction of ['sent','received'])if(el('transfer-count-'+direction))el('transfer-count-'+direction).textContent='0';
        if(!uid)return;
        try {
            const result=await window.tsTickets.getTransfers(request);
            if(current!==version || uid!==window.tsCurrentUser?.uid)return;
            records=Array.isArray(result.records)?result.records:[];render();
        } catch(error) {
            if(current!==version || uid!==window.tsCurrentUser?.uid)return;
            el('transfer-history-error').textContent=error.message||'Transfer history could not be loaded. Try again.';el('transfer-history-error').hidden=false;
        } finally {if(current===version)el('transfer-history-loading').hidden=true;}
    }
    tabs.forEach(tab=>tab.addEventListener('click',()=>{filter=tab.dataset.transferFilter;tabs.forEach(t=>{t.classList.toggle('active',t===tab);t.setAttribute('aria-pressed',String(t===tab));});render();}));
    el('transfer-search')?.addEventListener('input',render);el('transfer-history-refresh')?.addEventListener('click',load);
    window.addEventListener('ts-auth-ready',load);
})();
