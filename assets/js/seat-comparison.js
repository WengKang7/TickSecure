/* Isolated presentation previews; never calls reservation or selection handlers. */
(() => {
    window.tsSeatComparison = {mount(root, options = {}) {
        if (!root || !window.tsSeatViewModel || !window.tsSeatView3D) return null;
        const host=root.querySelector('#picker-comparison-panels'), panels=[];
        let model=null, scenes=new Map();
        const node=(tag,className,text)=>{const e=document.createElement(tag);e.className=className||'';if(text!==undefined)e.textContent=text;return e;};
        const comparable=seat=>String(seat.status).toUpperCase()!=='SOLD' && window.tsSeatViewModel.validPosition(seat.position);
        function render(panel) {
            if(!model || !root.open)return;
            const seat=model.seats.find(s=>s.id===panel.select.value && comparable(s));
            if(!seat){panel.canvas.hidden=true;panel.preview.disabled=true;panel.status.textContent='No unsold seat available to compare.';return;}
            panel.canvas.hidden=false;panel.preview.disabled=false;
            const page=seat.position.page||1;
            if(!scenes.has(page))scenes.set(page,window.tsSeatViewModel.createScene(model,page,{concertTheme:true}));
            const scene=scenes.get(page),ctx=panel.canvas.getContext('2d');
            if(!ctx){panel.status.textContent='3D preview unavailable in this browser.';return;}
            const width=Math.max(240,panel.canvas.getBoundingClientRect().width||320),height=200,ratio=Math.min(window.devicePixelRatio||1,1.5);
            panel.canvas.width=Math.round(width*ratio);panel.canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);
            window.tsSeatView3D.draw(ctx,scene,{concertTheme:true,viewSeatId:seat.id,selected:[],look:{},showPeople:false},width,height,[]);
            panel.status.textContent=`${model.categoryName} · RM${Number(model.unitPrice).toFixed(2)} · ${seat.status==='MINE'?'Held by you':String(seat.status).toLowerCase()}`;
        }
        for(const name of ['A','B']) {
            const section=node('section','ts-comparison-option'),label=node('label','ts-label',`Seat ${name}`),select=node('select','ts-select w-full'),canvas=node('canvas','ts-comparison-canvas'),status=node('p','small muted mt-12'),preview=node('button','ts-btn ts-btn-secondary w-full mt-12',`Explore seat ${name}`);
            select.id=`picker-compare-${name.toLowerCase()}`;label.htmlFor=select.id;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Seat ${name} illustrative stage view`);status.setAttribute('aria-live','polite');preview.type='button';
            const panel={select,canvas,status,preview};panels.push(panel);select.addEventListener('change',()=>render(panel));preview.addEventListener('click',()=>{if(model?.seats.some(s=>s.id===select.value && comparable(s)))options.onPreview?.(select.value);});section.append(label,select,canvas,status,preview);host.append(section);
        }
        root.addEventListener('toggle',()=>panels.forEach(render));
        const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>panels.forEach(render)):null;resize?.observe(host);
        return {update(next){if(next===model)return;model=next;scenes.clear();root.hidden=!model?.seats.some(s=>window.tsSeatViewModel.validPosition(s.position));
            panels.forEach((panel,index)=>{const old=panel.select.value;panel.select.replaceChildren();(model?.seats||[]).filter(comparable).forEach(seat=>{const option=node('option','',seat.displaySeatLabel||seat.seatLabel);option.value=seat.id;panel.select.append(option);});panel.select.disabled=!panel.select.options.length;
                const exists=[...panel.select.options].some(o=>o.value===old);if(exists)panel.select.value=old;else panel.select.selectedIndex=Math.min(index,panel.select.options.length-1);render(panel);
            });
        },dispose(){resize?.disconnect();host.replaceChildren();root.hidden=true;}};
    }};
})();
