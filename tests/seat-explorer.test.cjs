const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup({supported=true,reject=false}={}){
    const listeners={},events=[],button={hidden:true,disabled:false,attrs:{},addEventListener:(name,fn)=>listeners[name]=fn,setAttribute(k,v){this.attrs[k]=v},focus(){events.push('focus')}};
    const panel={async requestFullscreen(){if(reject)throw Error('denied');doc.fullscreenElement=panel;listeners.fullscreenchange();}};
    const doc={fullscreenEnabled:supported,fullscreenElement:null,getElementById:id=>id==='picker-explorer'?panel:button,addEventListener:(name,fn)=>listeners[name]=fn,async exitFullscreen(){doc.fullscreenElement=null;listeners.fullscreenchange();}};
    vm.runInNewContext(fs.readFileSync('assets/js/seat-explorer.js','utf8'),{document:doc,window:{dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type}}});
    return{button,doc,panel,listeners,events};
}
test('expanded view enters and exits without replacing the viewer, including browser Escape',async()=>{
    const f=setup();assert.equal(f.button.hidden,false);
    await f.listeners.click();assert.equal(f.doc.fullscreenElement,f.panel);assert.equal(f.button.attrs['aria-expanded'],'true');
    await f.listeners.click();assert.equal(f.doc.fullscreenElement,null);assert.equal(f.button.attrs['aria-expanded'],'false');
    await f.listeners.click();f.doc.fullscreenElement=null;f.listeners.fullscreenchange();
    assert.equal(f.button.textContent,'Expand view');assert.ok(f.events.includes('resize'));
});
test('unsupported or declined fullscreen keeps the normal viewer usable',async()=>{
    assert.equal(setup({supported:false}).button.hidden,true);
    const f=setup({reject:true});await f.listeners.click();
    assert.equal(f.doc.fullscreenElement,null);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'Expand unavailable');
});
