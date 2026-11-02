const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const address='0x'+'1'.repeat(40),contract='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const hex=n=>'0x'+BigInt(n).toString(16);
function fixture(options={}){
    const calls=[];let account=address,chain='0xaa36a7';
    const window={ethereum:{request:async request=>{
        calls.push(request);
        switch(request.method){
            case 'eth_accounts':return [account];
            case 'eth_chainId':return chain;
            case 'eth_feeHistory':
                if(options.feeError)throw Error('RPC unavailable');
                return options.history||{baseFeePerGas:[hex(10),hex(12)],reward:[[hex(2000000)],[hex(4000000)],[hex(3000000)]]};
            case 'eth_estimateGas':
                if(options.revert)throw Error('execution reverted');
                if(options.changeAccount)account=contract;
                if(options.changeChain)chain='0x1';
                return hex(100001);
            case 'eth_sendTransaction':return hash;
            default:throw Error('Unexpected RPC '+request.method);
        }
    }}};
    vm.runInNewContext(fs.readFileSync('assets/js/blockchain-wallet.js','utf8'),{window});
    return {calls,send:()=>window.tsChainWallet.send({from:address,...(options.deploy?{}:{to:contract}),data:'0x1234'})};
}
test('economy fees use recent low-percentile tips and projected base fee with exact integer arithmetic',async()=>{
    const p=fixture();assert.equal(await p.send(),hash);
    const request=p.calls.find(r=>r.method==='eth_sendTransaction').params[0];
    assert.equal(request.maxPriorityFeePerGas,hex(3000000));
    assert.equal(request.maxFeePerGas,hex(3000024));
    assert.equal(request.gas,hex(120002));assert.equal(request.value,'0x0');
    assert.deepEqual(Array.from(p.calls.find(r=>r.method==='eth_feeHistory').params[2]),[10]);
    assert.ok(p.calls.findIndex(r=>r.method==='eth_estimateGas')<p.calls.findIndex(r=>r.method==='eth_sendTransaction'));
});
test('quiet-chain tip is nonzero and high suggested tips are capped to favor lower cost',async()=>{
    for(const [tip,expected]of[[0,1000000],[9000000000,10000000]]){
        const p=fixture({history:{baseFeePerGas:['0x0','0x0'],reward:[[hex(tip)]]}});await p.send();
        const tx=p.calls.find(r=>r.method==='eth_sendTransaction').params[0];
        assert.equal(tx.maxPriorityFeePerGas,hex(expected));assert.equal(tx.maxFeePerGas,hex(expected));
    }
});
test('failed simulation, unavailable or malformed fee data never falls back to an expensive submission',async()=>{
    for(const options of[{revert:true},{feeError:true},{history:{}},{history:{baseFeePerGas:['0x0','bad'],reward:[['0x0']]}}]){
        const p=fixture(options);await assert.rejects(p.send());
        assert.equal(p.calls.some(r=>r.method==='eth_sendTransaction'),false);
    }
});
test('account or network changes during gas estimation prevent submission',async()=>{
    for(const options of[{changeAccount:true},{changeChain:true}]){
        const p=fixture(options);await assert.rejects(p.send(),/changed/);
        assert.equal(p.calls.some(r=>r.method==='eth_sendTransaction'),false);
    }
});
test('contract deployment uses the same economy policy without changing its bytecode',async()=>{
    const p=fixture({deploy:true});await p.send();
    const tx=p.calls.find(r=>r.method==='eth_sendTransaction').params[0];
    assert.equal(tx.to,undefined);assert.equal(tx.data,'0x1234');assert.ok(tx.maxFeePerGas);
});

test('NFT requests above the quoted demo fee budget pause without lowering execution gas or opening a transaction',async()=>{
    const p=fixture({history:{baseFeePerGas:[hex(1000000000),hex(1000000000)],reward:[['0x0']]}});
    await assert.rejects(p.send(),/0.0001 SepoliaETH/);
    assert.equal(p.calls.some(r=>r.method==='eth_sendTransaction'),false);
    assert.equal(p.calls.filter(r=>r.method==='eth_estimateGas').length,1);
});

test('contract deployment pauses above its separate 0.001 SepoliaETH quote cap',async()=>{
    const p=fixture({deploy:true,history:{baseFeePerGas:[hex(10000000000),hex(10000000000)],reward:[['0x0']]}});
    await assert.rejects(p.send(),/0.001 SepoliaETH/);assert.equal(p.calls.some(r=>r.method==='eth_sendTransaction'),false);
});
