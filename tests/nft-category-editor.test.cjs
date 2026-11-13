const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
function page() {
    class Element {
        constructor(){this.value='';this.hidden=false;this.dataset={};this.listeners={};this.children=[];}
        addEventListener(key,fn){this.listeners[key]=fn;}
        querySelectorAll(){return [];}
        replaceChildren(){this.children=[];}
        append(...values){this.children.push(...values);}
        setAttribute(key,value){this[key]=value;}
        showModal(){this.open=true;}
        close(){this.open=false;}
    }
    const elements = new Map();
    const el = id => {if(!elements.has(id)) elements.set(id,new Element());return elements.get(id);};
    const requests = [];
    let busy=false;
    const user = {uid:'organizer', getIdToken:async()=> 'organizer-token'};
    const window = {tsCollectibleArt:require('../assets/js/collectible-art.js'),tsFirebase:{auth:{currentUser:user}, backend:{projectUrl:'http://localhost/ticksecure-ui/'}}};
    vm.runInNewContext(fs.readFileSync('assets/js/nft-category-editor.js','utf8'), {
        window, document:{getElementById:el,createElement:()=>new Element()},URL,AbortSignal,location:{origin:'http://localhost'},
        fetch:async(url,request)=>{
            requests.push({url,request});
            return {ok:true,json:async()=>({suggestions:[{border:'gold',reason:'VIP edition'}]})};
        }
    });
    const editor = window.tsNftCategoryEditor({event:{id:'show'},isBusy:()=>busy,lock:value=>{busy=value;},changed(){}});
    return {el,editor,requests,window};
}
test('free AI gallery shows image options and the organizer chooses the saved photo',()=>{
    const p=page();
    p.editor.edit({imageUrl:'https://example.com/own.jpg',border:'silver'});
    p.el('nft-suggest').listeners.click();
    assert.equal(p.el('nft-gallery-dialog').open,true);
    const choices=p.el('nft-suggestions').children;
    assert.equal(choices.length,require('../assets/js/collectible-art.js').gallery().length);
    assert.equal(choices.filter(choice => choice.children[0].src.endsWith('.jpg')).length,9);
    assert.equal(p.editor.value().imageUrl,'https://example.com/own.jpg');
    assert.ok(choices[0].children[0].src.endsWith('.png'));
    choices[0].listeners.click();
    assert.equal(p.editor.value().imageUrl,choices[0].children[0].src);
    assert.equal(p.editor.value().border,'silver');
    assert.equal(p.el('nft-gallery-dialog').open,false);
    assert.equal(p.requests.length,0);
});
test('clearing or editing a category retains explicit image assignment without AI API calls',()=>{
    const p=page();
    p.editor.edit({imageUrl:'https://example.com/own.jpg',border:'gold'});
    p.el('nft-clear').listeners.click();
    assert.equal(p.editor.value().imageUrl,'');
    assert.equal(p.editor.value().border,'gold');
    p.editor.edit({imageUrl:'https://example.com/saved.jpg',border:'bronze'});
    assert.equal(p.el('nft-preview-image').src,'https://example.com/saved.jpg');
    assert.equal(p.editor.value().border,'bronze');
    assert.equal(p.requests.length,0);
});
test('every gallery choice points at an existing local AI-created image',()=>{
    const art=require('../assets/js/collectible-art.js');
    for(const item of art.gallery()) assert.ok(fs.existsSync('assets/images/collectibles/'+item.file));
});

test('closing the gallery preserves the current category photo',()=>{
    const p=page();
    p.editor.edit({imageUrl:'https://example.com/saved.jpg',border:'gold'});
    p.el('nft-suggest').listeners.click();
    p.el('nft-gallery-close').listeners.click();
    assert.equal(p.el('nft-gallery-dialog').open,false);
    assert.equal(p.editor.value().imageUrl,'https://example.com/saved.jpg');
});
