(function () {
    'use strict';
    const chainId='0xaa36a7',address=value=>/^0x[0-9a-fA-F]{40}$/.test(String(value||''));
    function provider(){if(!window.ethereum?.request)throw Error('Install or unlock MetaMask, then connect your wallet.');return window.ethereum;}
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
        const hash=await wallet.request({method:'eth_sendTransaction',params:[transaction]});
        if(!/^0x[0-9a-fA-F]{64}$/.test(String(hash)))throw Error('MetaMask did not return a transaction hash. Check wallet activity before retrying.');
        return hash.toLowerCase();
    }
    window.tsChainWallet={connect,send};
})();
