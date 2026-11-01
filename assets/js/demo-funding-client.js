import { invokeTrustedBackend } from './backend-client.js?v=20261101-demo-funding';

// Funding is automatic after connect; personal_sign proves control of the
// destination wallet without sharing a key or approving token spending.
export async function fundDemoWallet({ walletAddress, isActive = () => true, onStatus = () => {},
    provider = window.ethereum, invoke = invokeTrustedBackend, onlyIfNeeded = false, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    const notify = text => { if (isActive()) onStatus(text); };
    const call = (name, data) => invoke(data, { name, region: 'asia-southeast1' });
    if (!isActive()) return;
    if (onlyIfNeeded && provider?.request) {
        try {
            if (await provider.request({ method: 'eth_chainId' }) === '0xaa36a7'
                && BigInt(await provider.request({ method: 'eth_getBalance', params: [walletAddress, 'pending'] })) >= 1000000000000000n) {
                return { status: 'SUFFICIENT' };
            }
        } catch (_) { /* Funding lookup can still explain unavailable balances. */ }
    }
    if (!isActive()) return;
    notify('Checking your one-time demo gas allowance...');
    let result = await call('getDemoFundingChallenge', { walletAddress });
    if (!isActive()) return;
    let signature;
    if (result.status === 'SIGN') {
        if (!provider?.request) throw Error('Open MetaMask to verify your wallet for free demo gas.');
        if (await provider.request({ method: 'eth_chainId' }) !== '0xaa36a7') {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
        }
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (!isActive()) return;
        if (accounts?.[0]?.toLowerCase() !== walletAddress.toLowerCase()) throw Error('Select the connected buyer wallet to receive demo gas.');
        notify('Verify your wallet in MetaMask to receive free Sepolia demo gas. This signature costs no gas.');
        const message = '0x' + Array.from(new TextEncoder().encode(result.message), byte => byte.toString(16).padStart(2, '0')).join('');
        signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
        if (!isActive()) return;
        result = await call('claimDemoFunding', { walletAddress, signature });
    }
    for (let attempt = 0; isActive() && ['PENDING', 'BUSY'].includes(result.status) && attempt < 20; attempt++) {
        notify(result.status === 'PENDING' ? 'Your free demo gas transfer is confirming on Sepolia...' : result.message);
        await wait(3000);
        if (!isActive()) return;
        result = await call('claimDemoFunding', { walletAddress, ...(signature ? { signature } : {}) });
    }
    if (!isActive()) return;
    if (result.walletAddress && result.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        notify('This account already used its one-time demo gas allowance with another wallet.');
    } else if (result.status === 'FUNDED') notify(`Your one-time ${result.amount} SepoliaETH demo gas allowance has been received.`);
    else if (result.status === 'PENDING' || result.status === 'BUSY') {
        notify('Demo gas is still pending. Return shortly to check it; no second funding transfer will be created.');
    } else if (result.status === 'FAILED') {
        const message = 'Your demo gas transfer failed, so the NFT transaction has not been submitted. Ask the administrator to review and retry the failed funding transfer under Automatic buyer demo gas.';
        notify(message);
        throw Error(message);
    }
    else notify(result.message || 'Demo gas funding is not available. Your wallet connection is saved.');
    return result;
}
