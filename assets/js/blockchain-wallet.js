(function () {
    'use strict';
    const chainId='0xaa36a7',address=value=>/^0x[0-9a-fA-F]{40}$/.test(String(value||''));
    function provider(){if(!window.ethereum?.request)throw Error('Install or unlock MetaMask, then connect your wallet.');return window.ethereum;}
    const quantity=value=>{if(typeof value!=='string'||!/^0x[0-9a-fA-F]+$/.test(value))throw Error('Invalid gas estimate.');return BigInt(value);};
    const hex=value=>'0x'+value.toString(16);
    async function economicalFees(wallet){
        try{
            // Sample the low end of fees actually paid in the last five blocks.
            // The final base fee is the projected next-block base fee (EIP-1559).
            const history=await wallet.request({method:'eth_feeHistory',params:['0x5','latest',[10]]});
            if(!Array.isArray(history?.baseFeePerGas)||history.baseFeePerGas.length<2
                ||!Array.isArray(history.reward)||!history.reward.length)throw Error();
            const base=quantity(history.baseFeePerGas.at(-1));
            const tips=history.reward.map(row=>quantity(row?.[0])).sort((a,b)=>a<b?-1:a>b?1:0);
            let tip=tips[Math.floor(tips.length/2)];
            // A small nonzero tip for quiet Sepolia, capped at 0.01 gwei.
            // This favors economy over speed; pending hashes are never auto-resent.
            if(tip<1000000n)tip=1000000n; // 0.001 gwei
            if(tip>10000000n)tip=10000000n;
            return {maxPriorityFeePerGas:hex(tip),maxFeePerGas:hex(base*2n+tip)};
        }catch(_){throw Error('Could not calculate a low-cost Sepolia fee. Retry shortly; no transaction was submitted.');}
    }
    async function connect(){
        const wallet=provider();
        if(await wallet.request({method:'eth_chainId'})!==chainId){
            await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
        }
        const accounts=await wallet.request({method:'eth_requestAccounts'});
        if(!address(accounts?.[0]))throw Error('MetaMask did not return an account.');
        if(await wallet.request({method:'eth_chainId'})!==chainId)throw Error('Select Sepolia in MetaMask.');
        return accounts[0].toLowerCase();
    }
    async function send({from,to,data}){
        const wallet=provider(),accounts=await wallet.request({method:'eth_accounts'});
        if(!address(from)||accounts?.[0]?.toLowerCase()!==from.toLowerCase())throw Error('The selected wallet changed. Connect the required buyer wallet again.');
        if(await wallet.request({method:'eth_chainId'})!==chainId)throw Error('The network changed. Select Sepolia and try again.');
        if(!/^0x[0-9a-fA-F]+$/.test(data)||data.length%2!==0||(to&&!address(to)))throw Error('The prepared transaction is invalid. Refresh this page.');
        const transaction={from,value:'0x0',data};if(to)transaction.to=to;
        Object.assign(transaction,await economicalFees(wallet));
        // Simulate before asking for a signature so known reverts do not spend gas.
        // Extra gas allowance is a safety margin, not an extra fee: unused gas is not spent.
        let estimate;
        try{estimate=quantity(await wallet.request({method:'eth_estimateGas',params:[transaction]}));}
        catch(error){
            if(/insufficient funds|gas required exceeds allowance/i.test(error?.message||''))throw Error('This wallet cannot cover the Sepolia gas fee. Complete demo gas funding first, then retry. No NFT transaction was submitted.');
            throw error;
        }
        if(estimate<=0n)throw Error('Could not estimate gas. No transaction was submitted.');
        transaction.gas=hex((estimate*120n+99n)/100n);
        // Keep execution allowance intact. Pause expensive NFT requests rather
        // than risk wasting gas by cutting the gas limit below execution needs.
        // Deployment has different gas requirements and is not an NFT operation.
        if(to&&quantity(transaction.gas)*quantity(transaction.maxFeePerGas)>100000000000000n){
            throw Error('The quoted maximum NFT fee exceeds the 0.0001 SepoliaETH demo budget. No transaction was submitted. Retry when network fees are lower.');
        }
        // RPC estimation may take time. Recheck identity immediately before submission.
        const current=await wallet.request({method:'eth_accounts'});
        if(current?.[0]?.toLowerCase()!==from.toLowerCase())throw Error('The selected wallet changed. Connect the required buyer wallet again.');
        if(await wallet.request({method:'eth_chainId'})!==chainId)throw Error('The network changed. Select Sepolia and try again.');
        const hash=await wallet.request({method:'eth_sendTransaction',params:[transaction]});
        if(!/^0x[0-9a-fA-F]{64}$/.test(String(hash)))throw Error('MetaMask did not return a transaction hash. Check wallet activity before retrying.');
        return hash.toLowerCase();
    }
    window.tsChainWallet={connect,send};
})();
