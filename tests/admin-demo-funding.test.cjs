const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
class Element{
    constructor(){this.children=[];this.listeners={};}
    replaceChildren(...nodes){this.children=nodes;}
    appendChild(node){this.children.push(node);}
    addEventListener(type,callback){this.listeners[type]=callback;}
}
function fixture(options={}){
    const html=fs.readFileSync('organizer/blockchain.php','utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    const events={},calls=[],confirmations=[];
    const window={tsCurrentUser:null,addEventListener:(type,fn)=>events[type]=fn,tsConfirmDecision:async request=>{
        confirmations.push(request);if(options.logout){window.tsCurrentUser=null;await events['ts-auth-ready']();}return options.cancel?null:{};
    }};
    const invokeTrustedBackend=async(data,config)=>{
        calls.push({data,name:config.name});
        return config.name==='getDemoFundingSettings'?{configured:true,fundingWallet:'0x'+'1'.repeat(40),balanceWei:'10000000000000000',reservedWei:'0',amount:'0.002',dailyLimit:'0.02',
            failedClaims:[{claimId:'a'.repeat(64),walletAddress:'0x'+'2'.repeat(40),transactionHash:'0x'+'b'.repeat(64),retryAvailable:true}]}:{status:'PENDING'};
    };
    vm.runInNewContext(fs.readFileSync('assets/js/organizer-demo-funding.js','utf8').replace(/^import .*;\r?\n/gm,''),{
        window,invokeTrustedBackend,document:{getElementById:id=>elements.get(id),createElement:()=>new Element()}
    });
    return {calls,confirmations,elements,window,ready:async()=>{window.tsCurrentUser={uid:'organizer',role:'organizer',status:'active'};await events['ts-auth-ready']();},
        click:()=>elements.get('demo-funding-failures').children[0].children[1].listeners.click()};
}
test('failed funding retry requires explicit organizer confirmation and uses only the selected claim ID',async()=>{
    const p=fixture();await p.ready();await p.click();
    assert.equal(p.confirmations[0].requireAdmin,undefined);
    const retries=p.calls.filter(call=>call.name==='retryDemoFunding');assert.equal(retries.length,1);
    assert.equal(retries[0].data.claimId,'a'.repeat(64));assert.equal(Object.keys(retries[0].data).length,1);
    assert.match(p.elements.get('demo-funding-message').textContent,/retry submitted/);
});
test('cancelling a retry or losing organizer access never requests a new transfer',async()=>{
    for(const options of[{cancel:true},{logout:true}]){
        const p=fixture(options);await p.ready();await p.click();assert.equal(p.calls.some(call=>call.name==='retryDemoFunding'),false);
    }
});
