// Shared presentation tools for authenticated staff lists and reports.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.tsStaffTools = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const text = value => String(value ?? '');
    const esc = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const norm = value => text(value).trim().toUpperCase();
    const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    function date(value) {
        if (!value) return null;
        const result = value.toDate ? value.toDate() : new Date(value);
        return Number.isFinite(result.getTime()) ? result : null;
    }
    function day(value) {
        const d = date(value); if (!d) return '';
        const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
        const part = key => parts.find(p=>p.type===key).value;
        return `${part('year')}-${part('month')}-${part('day')}`;
    }
    const dateText = value => date(value)?.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'}) || 'Not recorded';
    const money = value => new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(number(value));
    function csv(rows) {
        return '\uFEFF' + rows.map(row=>row.map(value=>{
            let v=text(value); if (/^[\s]*[=+\-@]/.test(v)) v="'"+v;
            return '"'+v.replace(/"/g,'""')+'"';
        }).join(',')).join('\r\n');
    }
    function download(name, rows) {
        const url=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8;'}));
        const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function options(element, values, title) {
        const current=element.value;
        const entries=values instanceof Map ? [...values] : [...new Set(values.filter(Boolean))].sort().map(v=>[v,v]);
        element.innerHTML=`<option value="">${esc(title)}</option>`+entries.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
        element.value=entries.some(([id])=>id===current)?current:'';
    }
    const mintStatus = ticket => norm(ticket.mintingStatus) || 'PENDING';
    function paginate(rows, page, size=20) {
        const pages=Math.max(1,Math.ceil(rows.length/size)), current=Math.max(1,Math.min(page,pages));
        return {rows:rows.slice((current-1)*size,current*size),page:current,pages,total:rows.length};
    }
    function table(config) {
        const el=id=>document.getElementById(id), body=el(config.body), role=config.role;
        const footer=document.createElement('div');footer.className='ts-pagination';
        footer.innerHTML='<span role="status"></span><div class="flex gap-12"><button type="button" class="ts-btn ts-btn-secondary ts-btn-sm">Previous</button><button type="button" class="ts-btn ts-btn-secondary ts-btn-sm">Next</button><button type="button" class="ts-btn ts-btn-secondary ts-btn-sm">Refresh</button></div>';
        body.closest('.ts-card').append(footer);
        const [previous,next,refresh]=footer.querySelectorAll('button'), status=footer.querySelector('span');
        let rows=[],filtered=[],page=1,version=0,loaded=false;
        const allowed=()=>window.tsCurrentUser?.role===role && window.tsCurrentUser?.status==='active';
        function render(reset=false) {
            if (!allowed()) return;
            if(reset)page=1;
            filtered=rows.filter(config.filter || (()=>true));
            const result=paginate(filtered,page);page=result.page;
            body.innerHTML=result.rows.map(config.row).join('')||`<tr><td colspan="${config.columns}">No matching records.</td></tr>`;
            status.textContent=`${result.total} records · Page ${page} of ${result.pages}`;
            previous.disabled=!loaded||page===1;next.disabled=!loaded||page===result.pages;
            config.after?.(filtered,rows);config.bind?.(body,filtered);
        }
        async function load() {
            if(!allowed())return;
            const request=++version, uid=window.tsCurrentUser.uid;
            loaded=false;previous.disabled=next.disabled=refresh.disabled=true;config.exportButton && (el(config.exportButton).disabled=true);
            body.innerHTML=`<tr><td colspan="${config.columns}">Loading…</td></tr>`;
            try {
                const data=await config.load();
                if(request!==version||!allowed()||uid!==window.tsCurrentUser.uid)return;
                rows=data;loaded=true;config.loaded?.(rows);render();
                if(config.exportButton)el(config.exportButton).disabled=false;
            } catch(error) {
                if(request!==version||!allowed())return;
                rows=[];filtered=[];body.innerHTML=`<tr><td colspan="${config.columns}">${esc(error.message||'Unable to load records.')} Use Refresh to retry.</td></tr>`;status.textContent='Unable to load records';
                config.clear?.();
            } finally {if(request===version)refresh.disabled=false;}
        }
        previous.addEventListener('click',()=>{page--;render();});next.addEventListener('click',()=>{page++;render();});refresh.addEventListener('click',load);
        for(const id of config.controls||[])el(id).addEventListener(el(id).tagName==='INPUT'&&el(id).type!=='date'?'input':'change',()=>{if(loaded)render(true);});
        if(config.exportButton)el(config.exportButton).addEventListener('click',()=>{if(loaded&&allowed())download(config.filename,config.csv(filtered));});
        config.setup?.(()=>render(true));
        window.addEventListener('ts-auth-ready',()=>{if(allowed())load();else{version++;rows=[];filtered=[];loaded=false;body.innerHTML='';status.textContent='';previous.disabled=next.disabled=true;if(config.exportButton)el(config.exportButton).disabled=true;config.clear?.();}});
        if(allowed())load();
        return {refresh:load};
    }
    return {esc,norm,number,date,day,dateText,money,csv,download,options,mintStatus,paginate,table};
});
