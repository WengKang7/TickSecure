'use strict';
// A bounded, Sepolia-only demo faucet. Persist the exact signed transfer BEFORE
// broadcasting it; uncertain responses must never create a second payment.
const fs = require('node:fs'), path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { Wallet, verifyMessage, keccak256, formatEther } = require('ethers');
const { sepoliaRpc } = require('./blockchain');
const AMOUNT = 2000000000000000n; // 0.002 SepoliaETH, once per account AND wallet
const DAILY_LIMIT = 20000000000000000n; // 0.02 including maximum reserved gas
const MAX_GAS = 500000n, MAX_FEE = 100000000n; // Pause funding above 0.1 gwei.
const id = value => createHash('sha256').update(value).digest('hex');
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
const hex = value => '0x' + value.toString(16);
function localWallet() {
    let key = process.env.TICKSECURE_DEMO_FUNDING_KEY;
    if (!key) {
        const file = fs.realpathSync(process.env.TICKSECURE_DEMO_FUNDING_KEY_FILE || 'C:/xampp/private/ticksecure-demo-funding.json');
        const webroot = fs.realpathSync(path.resolve(__dirname, '../..'));
        if (file.toLowerCase().startsWith(webroot.toLowerCase() + path.sep)) throw Error('Private funding key must be outside the web root.');
        key = JSON.parse(fs.readFileSync(file, 'utf8')).privateKey;
    }
    return new Wallet(key);
}
function createDemoFundingService(db, { projectId, fail, rpc = sepoliaRpc, wallet = localWallet,
    enabled = () => process.env.TICKSECURE_DEMO_FUNDING === '1', now = () => Date.now(), nonce = () => randomBytes(24).toString('hex') } = {}) {
    const ref = (collection, key) => db.collection(collection).doc(key);
    const read = async (collection, key) => { const snap = await ref(collection, key).get(); return snap.exists ? snap.data() : null; };
    const day = () => new Date(now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stamp = () => new Date(now()).toISOString();
    const requireBuyer = (user, target) => {
        if (!user || user.role !== 'buyer' || user.status !== 'active' || user.emailVerified !== true) fail('permission-denied', 'An active, verified buyer account is required for demo gas funding.');
        if (!address(target) || String(user.walletAddress || '').toLowerCase() !== target.toLowerCase()) fail('permission-denied', 'Connect and save this wallet before requesting demo gas.');
    };
    // Legacy/in-flight grants retain their original amount; never reissue or
    // relabel an already committed transfer when the policy is reduced.
    const summary = claim => ({ status: claim.status, transactionHash: claim.transactionHash, walletAddress: claim.walletAddress, amount: formatEther(claim.amountWei), network: 'Sepolia' });
    async function setup() {
        if (!enabled()) return null;
        if (typeof projectId !== 'string' || !projectId) fail('failed-precondition', 'The demo funding Firebase project is not configured.');
        let signer;
        try { signer = await wallet(); } catch (_) { return null; }
        if (await rpc('eth_chainId') !== '0xaa36a7') fail('failed-precondition', 'Demo funding is restricted to Sepolia.');
        const config = await read('BlockchainSettings', 'sepolia');
        if (config && [config.signerAddress, config.operatorAddress].some(value => String(value || '').toLowerCase() === signer.address.toLowerCase())) {
            fail('failed-precondition', 'Use a separate demo funding wallet, not the administrator or NFT authorization wallet.');
        }
        return signer;
    }
    async function reconcile(signer) {
        const state = await read('DemoFundingState', 'sepolia');
        if (!state?.pendingClaimId) return;
        const claim = await read('DemoFundingClaims', state.pendingClaimId);
        if (!claim || claim.fundingWallet !== signer.address.toLowerCase()) fail('failed-precondition', 'Demo funding needs administrator review before continuing.');
        const receipt = await rpc('eth_getTransactionReceipt', [claim.transactionHash]);
        if (!receipt) {
            // Safe recovery after a timeout/crash: rebroadcast ONLY the persisted bytes.
            try { await rpc('eth_sendRawTransaction', [claim.rawTransaction]); } catch (_) { /* May already be in the pool. Keep its nonce and budget reserved. */ }
            return;
        }
        const [height, block] = await Promise.all([rpc('eth_blockNumber'), rpc('eth_getBlockByNumber', [receipt.blockNumber, false])]);
        if (String(receipt.transactionHash).toLowerCase() !== claim.transactionHash || !block
            || String(block.hash).toLowerCase() !== String(receipt.blockHash).toLowerCase()
            || BigInt(height) - BigInt(receipt.blockNumber) + 1n < 2n || !['0x0', '0x1'].includes(receipt.status)) return;
        await db.runTransaction(async tx => {
            const stateRef = ref('DemoFundingState', 'sepolia'), claimRef = ref('DemoFundingClaims', state.pendingClaimId);
            const [fresh, current] = await Promise.all([tx.get(stateRef), tx.get(claimRef)]);
            if (fresh.data()?.pendingClaimId !== state.pendingClaimId || current.data()?.transactionHash !== claim.transactionHash) return;
            tx.update(claimRef, { status: receipt.status === '0x1' ? 'FUNDED' : 'FAILED', confirmedAt: stamp() });
            tx.update(stateRef, { pendingClaimId: '', updatedAt: stamp() });
        });
    }
    async function existing(uid) { const claim = await read('DemoFundingClaims', id(uid)); return claim ? summary(claim) : null; }
    async function quote() {
        const history = await rpc('eth_feeHistory', ['0x5', 'latest', [10]]);
        const base = BigInt(history.baseFeePerGas.at(-1));
        const tips = history.reward.map(row => BigInt(row[0])).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        let tip = tips[Math.floor(tips.length / 2)];
        if (tip === undefined || base < 0n) fail('unavailable', 'Demo funding fee estimate is unavailable.');
        tip = tip < 1000000n ? 1000000n : tip > 10000000n ? 10000000n : tip;
        const fee = base * 2n + tip;
        if (fee > MAX_FEE) fail('unavailable', 'Sepolia fees are above the demo funding cap. Please try later.');
        return { tip, fee };
    }
    async function transferQuote(signer, target) {
        const fees = await quote();
        // A new account can cost more than the historical 21,000-gas transfer.
        // Simulate on the actual network, keep a margin and a hard spending bound.
        const estimate = BigInt(await rpc('eth_estimateGas', [{ from: signer.address, to: target,
            value: hex(AMOUNT), gas: hex(MAX_GAS), maxFeePerGas: hex(fees.fee), maxPriorityFeePerGas: hex(fees.tip) }]));
        const gas = (estimate * 120n + 99n) / 100n;
        if (estimate <= 0n || gas > MAX_GAS) fail('unavailable', 'The demo gas transfer exceeds its execution budget. No new transfer was submitted.');
        return { ...fees, gas, cost: AMOUNT + gas * fees.fee };
    }
    return {
        async settings(uid) {
            const user = await read('Users', uid);
            if (user?.role !== 'admin' || user.status !== 'active') fail('permission-denied', 'Administrator access is required.');
            const signer = await setup();
            if (!signer) return { configured: false, amount: formatEther(AMOUNT), dailyLimit: formatEther(DAILY_LIMIT) };
            const [balance, budget, failed] = await Promise.all([rpc('eth_getBalance', [signer.address, 'latest']), read('DemoFundingBudgets', day()),
                db.collection('DemoFundingClaims').where('status', '==', 'FAILED').limit(10).get()]);
            return { configured: true, fundingWallet: signer.address.toLowerCase(), balanceWei: BigInt(balance).toString(),
                reservedWei: budget?.reservedWei || '0', amount: formatEther(AMOUNT), dailyLimit: formatEther(DAILY_LIMIT), day: day(), network: 'Sepolia',
                failedClaims: failed.docs.map(doc => ({ claimId: doc.id, ...summary(doc.data()), retryAvailable: !(doc.data().retryCount >= 1) })) };
        },
        async challenge(uid, data) {
            const target = data?.walletAddress;
            requireBuyer(await read('Users', uid), target);
            const signer = await setup();
            if (!signer) return { status: 'UNAVAILABLE', message: 'Automatic demo gas funding is not configured yet. Your wallet connection is saved.' };
            await reconcile(signer);
            const previous = await existing(uid); if (previous) return previous;
            const walletId = id(target.toLowerCase());
            if (await read('DemoFundingWallets', walletId)) return { status: 'ALREADY_CLAIMED', message: 'This wallet has already received its one-time demo gas allowance.' };
            if (BigInt(await rpc('eth_getBalance', [target, 'latest'])) >= AMOUNT) return { status: 'SUFFICIENT', message: 'Your wallet already has Sepolia test ETH for NFT transactions.' };
            if (BigInt(await rpc('eth_getBalance', [signer.address, 'pending'])) < AMOUNT + MAX_GAS * MAX_FEE) return { status: 'EMPTY', message: 'The demo funding wallet needs test ETH from the administrator. Your wallet connection is saved.' };
            const challengeRef = ref('DemoFundingChallenges', id(uid));
            return db.runTransaction(async tx => {
                const [profile, old] = await Promise.all([tx.get(ref('Users', uid)), tx.get(challengeRef)]);
                requireBuyer(profile.data(), target);
                const previous = old.data();
                if (previous?.walletAddress === target.toLowerCase() && previous.expiresAt > now() && previous.amountWei === AMOUNT.toString()) return { status: 'SIGN', message: previous.message };
                const expiresAt = now() + 5 * 60 * 1000;
                const message = `TickSecure demo gas funding\nProject: ${projectId}\nAccount: ${uid}\nWallet: ${target.toLowerCase()}\nNetwork: Sepolia (11155111)\nAllowance: ${formatEther(AMOUNT)} SepoliaETH, once per account and wallet\nNonce: ${nonce()}\nExpires: ${new Date(expiresAt).toISOString()}\nThis signature verifies wallet control only. It does not approve spending or ticket transfers.`;
                tx.set(challengeRef, { uid, walletAddress: target.toLowerCase(), message, expiresAt, amountWei: AMOUNT.toString() });
                return { status: 'SIGN', message };
            });
        },
        async claim(uid, data) {
            const target = data?.walletAddress;
            requireBuyer(await read('Users', uid), target);
            const signer = await setup();
            if (!signer) return { status: 'UNAVAILABLE', message: 'Automatic demo gas funding is not configured yet.' };
            await reconcile(signer);
            const previous = await existing(uid); if (previous) return previous;
            const claimId = id(uid), claimRef = ref('DemoFundingClaims', claimId), walletRef = ref('DemoFundingWallets', id(target.toLowerCase()));
            const budgetDay = day();
            const challengeRef = ref('DemoFundingChallenges', claimId), stateRef = ref('DemoFundingState', 'sepolia'), budgetRef = ref('DemoFundingBudgets', budgetDay);
            const challenge = await read('DemoFundingChallenges', claimId);
            if (!challenge || challenge.walletAddress !== target.toLowerCase() || challenge.expiresAt <= now() || challenge.amountWei !== AMOUNT.toString()) fail('failed-precondition', 'Wallet verification expired or the allowance changed. Connect your wallet again to receive demo gas.');
            let recovered = '';
            try { recovered = verifyMessage(challenge.message, data.signature).toLowerCase(); } catch (_) { /* Reject invalid proofs below. */ }
            if (recovered !== target.toLowerCase()) fail('permission-denied', 'Sign the demo gas verification with the connected wallet.');
            if (await rpc('eth_getCode', [target, 'latest']) !== '0x') fail('failed-precondition', 'Automatic demo gas currently supports standard wallet accounts only.');
            const fees = await transferQuote(signer, target);
            const [balance, chainNonce] = await Promise.all([rpc('eth_getBalance', [signer.address, 'pending']), rpc('eth_getTransactionCount', [signer.address, 'pending'])]);
            if (BigInt(balance) < fees.cost) return { status: 'EMPTY', message: 'The administrator must refill the demo funding wallet with Sepolia test ETH.' };
            const outcome = await db.runTransaction(async tx => {
                // All reads precede signing/writes. A global pending slot serializes the
                // funding wallet across PHP processes, Functions instances and buyers.
                const [user, prior, fundedWallet, proof, state, budget] = await Promise.all([
                    tx.get(ref('Users', uid)), tx.get(claimRef), tx.get(walletRef), tx.get(challengeRef), tx.get(stateRef), tx.get(budgetRef)
                ]);
                requireBuyer(user.data(), target);
                if (prior.exists) return summary(prior.data());
                if (fundedWallet.exists) return { status: 'ALREADY_CLAIMED', message: 'This wallet has already received its one-time demo gas allowance.' };
                if (proof.data()?.message !== challenge.message || proof.data().expiresAt <= now() || proof.data().amountWei !== AMOUNT.toString()) fail('failed-precondition', 'Wallet verification changed or expired. Connect again.');
                if (state.data()?.pendingClaimId) return { status: 'BUSY', message: 'Another demo gas transfer is confirming. Retrying shortly...' };
                const reserved = BigInt(budget.data()?.reservedWei || '0');
                if (day() !== budgetDay) fail('unavailable', 'The funding budget day changed. Please retry.');
                if (reserved + fees.cost > DAILY_LIMIT) return { status: 'LIMIT', message: 'The daily demo gas budget is reached. Try after midnight (UTC+8) or fund your wallet from a faucet.' };
                const cachedNonce = BigInt(state.data()?.nextNonce || '0');
                const nonceValue = BigInt(chainNonce) > cachedNonce ? BigInt(chainNonce) : cachedNonce;
                if (nonceValue > BigInt(Number.MAX_SAFE_INTEGER)) fail('failed-precondition', 'Funding wallet nonce needs administrator review.');
                const rawTransaction = await signer.signTransaction({ type: 2, chainId: 11155111, nonce: Number(nonceValue),
                    to: target, value: AMOUNT, gasLimit: fees.gas, maxFeePerGas: fees.fee, maxPriorityFeePerGas: fees.tip });
                const claim = { uid, walletAddress: target.toLowerCase(), fundingWallet: signer.address.toLowerCase(),
                    amountWei: AMOUNT.toString(), maximumGasWei: (fees.gas * fees.fee).toString(), status: 'PENDING',
                    transactionHash: keccak256(rawTransaction), rawTransaction, nonce: Number(nonceValue), createdAt: stamp(), day: day() };
                tx.create(claimRef, claim);
                tx.create(walletRef, { uid, claimId, createdAt: stamp() });
                tx.set(budgetRef, { reservedWei: (reserved + fees.cost).toString(), updatedAt: stamp() });
                tx.set(stateRef, { pendingClaimId: claimId, nextNonce: (nonceValue + 1n).toString(), updatedAt: stamp() });
                return summary(claim);
            });
            // Only a committed PENDING claim can be sent. Recovery always uses the
            // identical raw transaction/hash, even when broadcast acknowledgement fails.
            if (outcome.status === 'PENDING') await reconcile(signer);
            return await existing(uid) || outcome;
        },
        async retryFailed(uid, data) {
            const admin = await read('Users', uid);
            if (admin?.role !== 'admin' || admin.status !== 'active') fail('permission-denied', 'Administrator access is required to retry failed funding.');
            if (!/^[a-f0-9]{64}$/.test(data?.claimId || '')) fail('invalid-argument', 'Select a failed demo funding record.');
            const signer = await setup();
            if (!signer) fail('failed-precondition', 'The demo funding wallet is not configured.');
            const claimRef = ref('DemoFundingClaims', data.claimId), claim = await read('DemoFundingClaims', data.claimId);
            if (!claim || claim.fundingWallet !== signer.address.toLowerCase()) fail('not-found', 'Failed funding record not found for this funding wallet.');
            // An uncertain/PENDING transfer is never replaced by this action.
            if (claim.status !== 'FAILED' || claim.retryCount >= 1) fail('failed-precondition', 'Only a failed funding transfer with no previous retry can be retried.');
            const receipt = await rpc('eth_getTransactionReceipt', [claim.transactionHash]);
            if (!receipt || receipt.status !== '0x0' || String(receipt.transactionHash).toLowerCase() !== claim.transactionHash) fail('failed-precondition', 'The previous transfer must have a proven failed receipt.');
            const [height, block] = await Promise.all([rpc('eth_blockNumber'), rpc('eth_getBlockByNumber', [receipt.blockNumber, false])]);
            if (!block || String(block.hash).toLowerCase() !== String(receipt.blockHash).toLowerCase()
                || BigInt(height) - BigInt(receipt.blockNumber) + 1n < 2n) fail('failed-precondition', 'Wait for a canonical failed transfer with two confirmations.');
            const target = claim.walletAddress, fees = await transferQuote(signer, target), budgetDay = day();
            const [balance, chainNonce] = await Promise.all([rpc('eth_getBalance', [signer.address, 'pending']), rpc('eth_getTransactionCount', [signer.address, 'pending'])]);
            if (BigInt(balance) < fees.cost) fail('failed-precondition', 'Refill the demo funding wallet with Sepolia test ETH first.');
            const result = await db.runTransaction(async tx => {
                const stateRef = ref('DemoFundingState', 'sepolia'), budgetRef = ref('DemoFundingBudgets', budgetDay);
                const [actor, buyer, current, state, budget] = await Promise.all([tx.get(ref('Users', uid)), tx.get(ref('Users', claim.uid)), tx.get(claimRef), tx.get(stateRef), tx.get(budgetRef)]);
                if (actor.data()?.role !== 'admin' || actor.data()?.status !== 'active') fail('permission-denied', 'Administrator access is required.');
                requireBuyer(buyer.data(), target);
                const fresh = current.data();
                if (fresh?.status !== 'FAILED' || fresh.transactionHash !== claim.transactionHash || fresh.retryCount >= 1) fail('failed-precondition', 'This funding record changed. Refresh before retrying.');
                if (state.data()?.pendingClaimId) fail('failed-precondition', 'Another funding transfer is pending. Wait for it to finish first.');
                const reserved = BigInt(budget.data()?.reservedWei || '0');
                if (day() !== budgetDay || reserved + fees.cost > DAILY_LIMIT) fail('failed-precondition', 'The daily demo funding budget cannot cover this retry. Try after midnight UTC+8.');
                const nonceValue = BigInt(chainNonce) > BigInt(state.data()?.nextNonce || '0') ? BigInt(chainNonce) : BigInt(state.data()?.nextNonce || '0');
                if (nonceValue > BigInt(Number.MAX_SAFE_INTEGER)) fail('failed-precondition', 'Funding nonce needs review.');
                const rawTransaction = await signer.signTransaction({ type: 2, chainId: 11155111, nonce: Number(nonceValue), to: target,
                    value: AMOUNT, gasLimit: fees.gas, maxFeePerGas: fees.fee, maxPriorityFeePerGas: fees.tip });
                const updated = { ...fresh, amountWei: AMOUNT.toString(), maximumGasWei: (fees.gas * fees.fee).toString(),
                    status: 'PENDING', rawTransaction, transactionHash: keccak256(rawTransaction), nonce: Number(nonceValue),
                    retryCount: 1, retriedBy: uid, retriedAt: stamp(), day: budgetDay,
                    previousAttempts: [{ transactionHash: fresh.transactionHash, amountWei: fresh.amountWei, status: 'FAILED', confirmedAt: fresh.confirmedAt || '' }] };
                tx.update(claimRef, updated);
                tx.set(budgetRef, { reservedWei: (reserved + fees.cost).toString(), updatedAt: stamp() });
                tx.set(stateRef, { pendingClaimId: data.claimId, nextNonce: (nonceValue + 1n).toString(), updatedAt: stamp() });
                return summary(updated);
            });
            await reconcile(signer);
            return result;
        }
    };
}
module.exports = { createDemoFundingService, AMOUNT, DAILY_LIMIT };
