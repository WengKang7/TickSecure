// Checkout starts minting; the wallet owner still approves every transaction.
// Dependencies are injected so recovery and account changes can be tested offline.
export function createBookingMinter({ client, wallet, storage, locks, isActive, onUpdate, ensureFunding = async () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    let running = false;
    const hash = value => /^0x[0-9a-fA-F]{64}$/.test(String(value || ''));
    const confirmed = record => record.status === 'CONFIRMED' && record.verificationVersion === 2;
    const read = key => { try { return storage.getItem(key) || ''; } catch (_) { return ''; } };
    const save = (key, value) => { try { value ? storage.setItem(key, value) : storage.removeItem(key); } catch (_) { /* Backend/hash recovery remains available. */ } };
    async function process(bookingId, uid) {
        const result = await client.listBuyer({ bookingId });
        if (!isActive(uid)) return;
        const records = (result.records || []).filter(record => record.transactionType === 'MINT' && record.performedByYou);
        if (!records.length) throw Error('Ticket NFT records are not available yet. Your booking is confirmed; you can continue NFT setup later.');
        const progress = { total: records.length, confirmed: records.filter(confirmed).length, hashes: records.filter(confirmed).map(r => r.transactionHash).filter(hash) };
        const update = (state, message) => { if (isActive(uid)) onUpdate({ ...progress, hashes: [...progress.hashes], state, message }); };
        for (const record of records) {
            if (!isActive(uid)) return;
            if (confirmed(record)) continue;
            if (!result.configured) throw Error('The administrator must finish Sepolia contract setup. Your tickets are saved; NFT setup can continue later.');
            const key = `ticksecure:buyer-chain:${uid}:${record.id}`;
            let submitted = read(key) || (record.status !== 'FAILED' && hash(record.transactionHash) ? record.transactionHash : '');
            if (!hash(submitted)) {
                if (!record.canSubmit) throw Error(record.blockedReason || 'This ticket NFT cannot be submitted yet. Open NFT details to continue later.');
                update('preparing', `Preparing ticket NFT ${progress.confirmed + 1} of ${progress.total}...`);
                const prepared = await client.prepare(record.id);
                if (!isActive(uid)) return;
                if (prepared.alreadyRecorded) {
                    if (!hash(prepared.transactionHash)) throw Error('This NFT operation already exists. Open NFT details and recover its transaction hash; do not submit it again.');
                    submitted = prepared.transactionHash;
                } else {
                    update('awaiting-wallet', `Approve ticket NFT ${progress.confirmed + 1} of ${progress.total} in MetaMask. Sepolia test ETH is required for gas.`);
                    const address = await wallet.connect();
                    if (!isActive(uid)) return;
                    if (address.toLowerCase() !== String(prepared.actorWallet).toLowerCase()) throw Error('Select the wallet used for this booking in MetaMask: ' + prepared.actorWallet);
                    await ensureFunding(address, uid);
                    if (!isActive(uid)) return;
                    if (prepared.deadline && Date.now() / 1000 >= prepared.deadline) throw Error('The wallet request expired. Continue NFT setup to get a fresh request.');
                    submitted = await wallet.send({ from: address, to: prepared.contractAddress, data: prepared.calldata });
                    if (!hash(submitted)) throw Error('The wallet did not return a transaction hash. Check wallet activity before continuing.');
                    // Save even if the page/account changed while MetaMask was open.
                    save(key, submitted);
                }
            }
            if (!isActive(uid)) return;
            update('submitted', 'NFT transaction submitted. Waiting for two Sepolia confirmations...');
            let settled = false;
            for (let attempt = 0; attempt < 25; attempt++) {
                const verified = await client.verify(record.id, submitted);
                if (!isActive(uid)) return;
                if (verified.status === 'CONFIRMED') {
                    save(key, ''); progress.confirmed++; progress.hashes.push(submitted); settled = true;
                    update('confirming', `${progress.confirmed} of ${progress.total} ticket NFTs confirmed.`);
                    break;
                }
                if (verified.status === 'FAILED') {
                    save(key, '');
                    throw Error('The NFT transaction reverted. Your booking is confirmed. Check NFT details before retrying.');
                }
                if (attempt < 24) await wait(5000);
                if (!isActive(uid)) return;
            }
            if (!settled) {
                update('pending', 'Your transaction is still pending. Continue NFT setup to check the same hash without sending it again.');
                return;
            }
        }
        update('complete', 'All ticket NFTs are confirmed on Sepolia. Your tickets are ready in My Tickets.');
    }
    return { async run(bookingId, uid) {
        if (running || !isActive(uid)) return;
        running = true;
        try {
            if (locks?.request) return await locks.request(`ticksecure:buyer-chain:${uid}`, { ifAvailable: true }, lock => {
                if (!lock) throw Error('An NFT transaction is already running in another tab. Continue there.');
                return process(bookingId, uid);
            });
            return await process(bookingId, uid);
        } finally { running = false; }
    } };
}
