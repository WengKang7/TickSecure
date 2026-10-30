import { sepolia } from './blockchain-client.js?v=20261030-buyer-chain-v2';
const el=id=>document.getElementById(id),node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
let uid='',version=0,busy=false,settings=null,records=[],timer;
const active=()=>window.tsCurrentUser?.uid===uid&&window.tsCurrentUser?.role==='admin'&&window.tsCurrentUser?.status==='active';
const validHash=value=>/^0x[0-9a-fA-F]{64}$/.test(String(value||''));
function message(value,error=false){const target=el(error?'chain-error':'chain-message');target.textContent=value||'';target.hidden=!value;}
function saved(value){try{const key='ticksecure:sepolia-deployment:'+uid;if(value===undefined)return localStorage.getItem(key)||'';value?localStorage.setItem(key,value):localStorage.removeItem(key);}catch(_){}return '';}
function explorer(value,type='tx'){const link=node('a','ts-chain-code',value);link.href='https://sepolia.etherscan.io/'+type+'/'+encodeURIComponent(value);link.target='_blank';link.rel='noopener noreferrer';return link;}
function render(){
    for(const id of ['chain-refresh','chain-connect','chain-register'])el(id).disabled=busy||!active();
    el('chain-deploy').disabled=busy||!active()||!settings?.deploymentBytecode||Boolean(el('chain-deployment-hash').value.trim());
    el('chain-deployment').hidden=Boolean(settings?.configured);el('chain-operator').textContent=settings?.operatorAddress||'Not registered';
    el('chain-contract').replaceChildren(settings?.contractAddress?explorer(settings.contractAddress,'address'):node('span','','Not deployed'));
    for(const [id,value] of [['tx-total-kpi',records.length],['tx-confirmed-kpi',records.filter(r=>r.status==='CONFIRMED').length],['tx-pending-kpi',records.filter(r=>!['CONFIRMED','FAILED'].includes(r.status)).length],['tx-failed-kpi',records.filter(r=>r.status==='FAILED').length]])el(id).textContent=String(value);
    const search=el('chain-search').value.trim().toLowerCase(),status=el('chain-status').value,type=el('chain-type').value;
    const rows=records.filter(r=>(!status||r.status===status)&&(!type||r.transactionType===type)&&[r.id,r.ticketId,r.transactionHash,r.walletAddress].some(v=>String(v||'').toLowerCase().includes(search))).map(record=>{
        const row=node('tr'),hash=node('td');if(validHash(record.transactionHash)&&record.chainId===11155111)hash.append(explorer(record.transactionHash));else hash.append(node('span','small secondary','Awaiting buyer submission'));
        hash.append(node('small','ts-chain-record-id','Record: '+record.id));
        const ticket=node('td');ticket.append(node('strong','',record.transactionType),node('div','ts-chain-code',record.ticketId));
        const state=node('td');state.append(node('span','ts-chip ts-chip-'+(record.status==='CONFIRMED'?'success':record.status==='FAILED'?'error':'neutral'),record.status||'PENDING'));
        if(record.failureReason)state.append(node('small','ts-chain-record-id',record.failureReason));
        row.append(hash,node('td','ts-chain-code',record.walletAddress||''),ticket,state,node('td','small',record.timestamp?new Date(record.timestamp).toLocaleString('en-GB',{timeZone:'Asia/Singapore'}):''),node('td','small secondary','Buyer performs this action'));return row;
    });
    if(!rows.length){const row=node('tr'),cell=node('td','text-center secondary','No matching records.');cell.colSpan=6;row.append(cell);rows.push(row);}
    el('tx-table-body').replaceChildren(...rows);
}
async function load(){
    const v=++version;clearTimeout(timer);uid=window.tsCurrentUser?.uid||'';busy=false;settings=null;records=[];message('');message('',true);render();
    if(!active())return;
    try{const [config,loaded]=await Promise.all([sepolia.getSettings(),window.tsBlockchain.getTransactions()]);if(v!==version||!active())return;
        settings=config;records=loaded;el('chain-deployment-hash').value=saved();render();
        if(config.setupMessage)message(config.setupMessage,true);if(config.migrationRequired)message('An earlier contract is registered. A deliberate migration is required before using buyer-authorized transactions.',true);
    }catch(error){if(v===version)message(error.message||'Blockchain data could not be loaded.',true);}
}
async function run(action){if(busy||!active())return;busy=true;const v=version;message('');message('',true);render();try{await action(v);}catch(error){if(v===version)message(error.code===4001?'The MetaMask request was cancelled.':error.message||'Setup failed.',true);}finally{if(v===version){busy=false;render();}}}
async function register(v,attempt=0){
    const hash=el('chain-deployment-hash').value.trim();if(!validHash(hash))throw Error('Enter the deployment transaction hash.');saved(hash);
    try{const result=await sepolia.configure(hash);if(v!==version||!active())return;saved('');settings={...result,configured:true};message('Contract registered. Buyers can now approve their own NFT operations in My blockchain.');}
    catch(error){if(v===version&&['unavailable','functions/unavailable'].includes(error.code)){message(error.message);if(attempt<24)timer=setTimeout(()=>{if(v===version&&active()&&!busy)run(next=>register(next,attempt+1));},5000);}else throw error;}
}
el('chain-connect').addEventListener('click',()=>run(async v=>{const wallet=await window.tsChainWallet.connect();if(v===version&&active())el('chain-wallet').textContent=wallet;}));
el('chain-deploy').addEventListener('click',()=>run(async v=>{
    const bytecode=settings?.deploymentBytecode;if(!bytecode)return;
    const wallet=await window.tsChainWallet.connect();if(v!==version||!active())return;el('chain-wallet').textContent=wallet;
    if(!await window.tsConfirmDecision({requireAdmin:true,title:'Deploy the buyer-enabled ticket contract?',label:'Continue to MetaMask',subject:'Sepolia setup',message:'This is a one-time setup transaction. Buyers will submit their own mint, transfer and resale operations.',details:[['Network','Sepolia (11155111)'],['Contract administrator',wallet],['Authorization signer',settings.signerAddress]]}))return;
    if(v!==version||!active())return;const hash=await window.tsChainWallet.send({from:wallet,data:bytecode});saved(hash);if(v!==version||!active())return;el('chain-deployment-hash').value=hash;await register(v);
}));
el('chain-register').addEventListener('click',()=>run(register));el('chain-refresh').addEventListener('click',load);
el('chain-deployment-hash').addEventListener('input',()=>{saved(el('chain-deployment-hash').value.trim());render();});
for(const id of ['chain-search','chain-status','chain-type'])el(id).addEventListener(id==='chain-search'?'input':'change',render);
window.addEventListener('ts-auth-ready',load);window.addEventListener('pagehide',()=>{++version;clearTimeout(timer);});if(window.tsCurrentUser)load();
