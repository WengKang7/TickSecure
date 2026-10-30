import { sepolia } from './blockchain-client.js?v=20261030-buyer-chain-v2';
const el=id=>document.getElementById(id),D=window.tsBlockchainDisplay,role=document.querySelector('[data-chain-role]').dataset.chainRole;
const params=new URLSearchParams(window.location.search),filters={};for(const key of ['ticketId','bookingId'])if(params.get(key))filters[key]=params.get(key);
let uid='',version=0,busy=false,records=[],configured=false,timer;
const active=()=>window.tsCurrentUser?.uid===uid&&window.tsCurrentUser?.role===role&&window.tsCurrentUser?.status==='active';
const storageKey=r=>`ticksecure:buyer-chain:${uid}:${r.id}`;
function stored(key,value){try{if(value===undefined)return localStorage.getItem(key)||'';value?localStorage.setItem(key,value):localStorage.removeItem(key);}catch(_){}return '';}
function knownHash(r){return stored(storageKey(r))||(r.status!=='FAILED'&&D.hash(r.transactionHash)?r.transactionHash:'');}
function message(text,error=false){const target=el(error?'buyer-chain-error':'buyer-chain-message');target.textContent=text||'';target.hidden=!text;}
function render(){
    el('buyer-chain-refresh').disabled=busy;el('buyer-chain-pending').textContent=String(records.filter(r=>!D.confirmed(r)).length);el('buyer-chain-confirmed').textContent=String(records.filter(D.confirmed).length);
    const search=el('buyer-chain-search').value.trim().toLowerCase(),status=el('buyer-chain-filter').value;
    const shown=records.filter(r=>(!params.get('recordId')||r.id===params.get('recordId'))&&(!status||r.status===status)&&[r.eventName,r.ticketId,r.transactionHash,r.walletAddress,r.actorWallet].some(v=>String(v||'').toLowerCase().includes(search)));
    const cards=shown.map(record=>{
        const card=D.receipt(record);
        if(role==='buyer'&&!D.confirmed(record)&&record.performedByYou){
            const hash=knownHash(record),button=D.node('button','ts-btn ts-btn-primary',hash?'Verify my transaction':({MINT:'Mint my NFT',TRANSFER:'Complete NFT transfer',RESALE:'Receive resale NFT'}[record.transactionType]||'Approve in MetaMask'));
            button.type='button';button.disabled=busy||(!record.canSubmit&&!hash);button.addEventListener('click',()=>run(v=>publish(record,v)));card.append(button);
        }else if(role==='buyer'&&!D.confirmed(record))card.append(D.node('p','small secondary','This operation must be submitted by the responsible buyer.'));
        if(record.isCurrentOwner){const link=D.node('a','ts-btn ts-btn-secondary','View ticket');link.href='ticket-detail.php?id='+encodeURIComponent(record.ticketId);card.append(link);}
        return card;
    });
    el('buyer-chain-list').replaceChildren(...(cards.length?cards:[D.node('p','ts-transfer-empty','No matching blockchain records for your account.')]));
    const select=el('buyer-chain-recovery-id');if(select){const value=select.value;select.replaceChildren(...records.filter(r=>r.performedByYou).map(r=>{const option=D.node('option','',r.transactionType+' · '+r.ticketId+' · '+r.id);option.value=r.id;return option;}));if(records.some(r=>r.id===value))select.value=value;el('buyer-chain-recover').disabled=busy||!select.children.length;}
}
async function refresh(v=version){const result=await(role==='organizer'?sepolia.listOrganizer(filters):sepolia.listBuyer(filters));if(v!==version||!active())return;records=result.records||[];configured=result.configured;render();if(!configured)message('The administrator must finish the buyer-enabled Sepolia contract setup before transactions can be submitted.');}
async function load(){const v=++version;clearTimeout(timer);uid=window.tsCurrentUser?.uid||'';busy=false;records=[];configured=false;message('');message('',true);render();el('buyer-chain-loading').hidden=!active();if(!active())return;
    try{await refresh(v);}catch(error){if(v===version)message(error.message||'Blockchain activity could not be loaded.',true);}finally{if(v===version)el('buyer-chain-loading').hidden=true;}}
async function run(action){if(busy||!active()||role!=='buyer')return;const v=version;busy=true;message('');message('',true);render();try{await action(v);}catch(error){if(v===version)message(error.code===4001?'The MetaMask request was cancelled. Your NFT operation is still pending.':error.message||'Could not complete the transaction.',true);}finally{if(v===version){busy=false;render();}}}
async function verify(record,hash,v,attempt=0){const result=await sepolia.verify(record.id,hash);if(v!==version||!active())return;await refresh(v);
    if(result.status==='CONFIRMED'){stored(storageKey(record),'');message('Confirmed on Sepolia. Your transaction hash is saved in Firebase.');}
    else if(result.status==='FAILED'){stored(storageKey(record),'');message('The transaction reverted. Inspect its hash before trying again.',true);}
    else{message('Submitted. Waiting for two Sepolia confirmations. You can keep this page open or return and verify the same hash.');clearTimeout(timer);if(attempt<24)timer=setTimeout(()=>{if(v===version&&active()&&!busy)run(next=>verify(record,hash,next,attempt+1));},5000);}
}
async function publish(record,v){
    const hash=knownHash(record);if(D.hash(hash))return verify(record,hash,v);
    const prepared=await sepolia.prepare(record.id);if(v!==version||!active())return;
    if(prepared.alreadyRecorded){if(D.hash(prepared.transactionHash))return verify(record,prepared.transactionHash,v);throw Error('This operation already exists on Sepolia. Recover it using the transaction hash from your wallet.');}
    const wallet=await window.tsChainWallet.connect();if(v!==version||!active())return;
    if(wallet!==prepared.actorWallet.toLowerCase())throw Error('Select the buyer wallet required for this operation: '+prepared.actorWallet);
    const confirmation=await window.tsConfirmDecision({title:record.transactionType==='MINT'?'Mint your ticket NFT?':'Complete this ticket NFT transaction?',label:'Continue to MetaMask',subject:record.eventName||record.ticketId,
        message:'You will submit this transaction from your own wallet on Sepolia and pay test ETH gas.',details:[['Action',record.transactionType],['Your wallet',wallet],['Receiver',prepared.walletAddress],['Ticket',record.ticketId],['Network','Sepolia (11155111)']]});
    if(!confirmation||v!==version||!active())return;
    if(prepared.deadline&&Date.now()/1000>=prepared.deadline)throw Error('The wallet authorization expired. Review the action again to get a fresh authorization.');
    const key=storageKey(record),submitted=await window.tsChainWallet.send({from:wallet,to:prepared.contractAddress,data:prepared.calldata});stored(key,submitted);
    if(v!==version||!active())return;await verify(record,submitted,v);
}
el('buyer-chain-refresh').addEventListener('click',load);el('buyer-chain-search').addEventListener('input',render);el('buyer-chain-filter').addEventListener('change',render);
el('buyer-chain-recover')?.addEventListener('click',()=>run(v=>{const record=records.find(r=>r.id===el('buyer-chain-recovery-id').value),hash=el('buyer-chain-recovery-hash').value.trim();if(!record||!record.performedByYou||!D.hash(hash))throw Error('Select your operation and enter a valid transaction hash.');return verify(record,hash,v);}));
if(el('buyer-chain-all'))el('buyer-chain-all').hidden=!params.toString();
if(params.get('transferId')&&el('buyer-chain-receipt')){el('buyer-chain-receipt').href='ticket-transfers.php?transferId='+encodeURIComponent(params.get('transferId'));el('buyer-chain-receipt').hidden=false;}
window.addEventListener('ts-auth-ready',load);window.addEventListener('pagehide',()=>{++version;clearTimeout(timer);});if(window.tsCurrentUser)load();
