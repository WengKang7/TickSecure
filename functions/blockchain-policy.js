'use strict';
const { createHash } = require('node:crypto');
const CHAIN_ID = 11155111;
const ZERO = '0x' + '0'.repeat(40);
const hash = value => '0x' + createHash('sha256').update(value).digest('hex');
const lower = value => String(value || '').toLowerCase();
const address = value => /^0x[0-9a-f]{40}$/.test(lower(value)) && lower(value) !== ZERO;
const word = value => lower(value).replace(/^0x/, '').padStart(64, '0');
const verified = (record, settings) => record.status === 'CONFIRMED' && record.verificationVersion === 2
    && record.chainId === CHAIN_ID && lower(record.contractAddress) === lower(settings.contractAddress);

function operation(projectId, settings, record, history, artifact, fail) {
    const kind = { MINT: 1, TRANSFER: 2, RESALE: 3 }[record.transactionType];
    if (!kind || !address(record.walletAddress) || !record.ticketId || !record.id) fail('failed-precondition', 'This record has incomplete ticket or wallet details.');
    const compare = (a,b) => a === b ? 0 : a < b ? -1 : 1;
    const ordered = [...history].sort((a,b) => compare(String(a.timestamp || ''),String(b.timestamp || ''))
        || Number(b.transactionType === 'MINT') - Number(a.transactionType === 'MINT') || compare(a.id,b.id));
    const index = ordered.findIndex(item => item.id === record.id);
    if (index < 0) fail('not-found', 'Blockchain record not found.');
    const earlier = ordered.slice(0,index);
    if (earlier.some(item => !verified(item,settings))) fail('failed-precondition', 'Confirm the earlier blockchain records for this ticket first.');
    if ((kind === 1 && earlier.length) || (kind !== 1 && (!earlier.length || earlier[0].transactionType !== 'MINT')))
        fail('failed-precondition', 'The ticket needs its original mint record before a transfer or resale.');
    const from = kind === 1 ? ZERO : lower(earlier.at(-1).walletAddress);
    if (kind !== 1 && !address(from)) fail('failed-precondition', 'The preceding owner wallet is unavailable.');
    const to = lower(record.walletAddress), contract = lower(settings.contractAddress);
    const tokenId = hash(`ticksecure:ticket:v1:${projectId}:${record.ticketId}`);
    const operationId = hash(`ticksecure:operation:v1:${projectId}:${record.id}`);
    const recordHash = hash(JSON.stringify(['ticksecure-v1', String(CHAIN_ID), contract, record.id,
        record.transactionType, record.ticketId, from, to, String(record.timestamp || '')]));
    return { chainId: CHAIN_ID, contractAddress: contract, tokenId, operationId, recordHash, fromWallet: from,
        walletAddress: to, transactionType: record.transactionType };
}

function verifyTransaction(tx, receipt, block, height, expected, settings, artifact, fail) {
    if (!tx) fail('unavailable', 'The transaction is not visible to the Sepolia provider yet. Retry verification with the same hash.');
    if (lower(tx.to) !== expected.contractAddress || lower(tx.from) !== lower(expected.actorWallet)
        || lower(tx.input || tx.data) !== expected.calldata || BigInt(tx.value || '0x0') !== 0n)
        fail('invalid-argument', 'This transaction does not match the selected ticket operation.');
    if (!receipt) return { status: 'SUBMITTED', confirmations: 0 };
    if (lower(receipt.transactionHash) !== lower(tx.hash) || lower(receipt.to) !== expected.contractAddress
        || lower(receipt.from) !== lower(expected.actorWallet)) fail('invalid-argument', 'The transaction receipt does not match.');
    if (!block || lower(block.hash) !== lower(receipt.blockHash)) fail('unavailable', 'The receipt is not in the current canonical chain. Retry verification.');
    const confirmations = Math.max(0, Number(BigInt(height) - BigInt(receipt.blockNumber) + 1n));
    if (receipt.status === '0x0') return { status: confirmations >= 2 ? 'FAILED' : 'SUBMITTED', confirmations, failureReason: confirmations >= 2 ? 'Sepolia reverted this transaction. No token change was confirmed.' : '' };
    if (receipt.status !== '0x1') fail('unavailable', 'The provider did not return a successful receipt.');
    const data = '0x' + [({ MINT:1,TRANSFER:2,RESALE:3 }[expected.transactionType]).toString(16),expected.fromWallet,expected.walletAddress,expected.recordHash].map(word).join('');
    const match = (receipt.logs || []).some(log => !log.removed && lower(log.address) === expected.contractAddress
        && log.topics?.length === 3 && lower(log.topics[0]) === lower(artifact.eventTopic)
        && lower(log.topics[1]) === expected.operationId && lower(log.topics[2]) === expected.tokenId && lower(log.data) === data);
    if (!match) fail('invalid-argument', 'The receipt has no matching TickSecure ticket event.');
    return { status: confirmations >= 2 ? 'CONFIRMED' : 'SUBMITTED', confirmations,
        blockNumber: Number(BigInt(receipt.blockNumber)), blockHash: lower(receipt.blockHash), failureReason: '' };
}
function runtimeMatches(code,artifact) {
    const mask=value=>{let result=lower(value);for(const ranges of Object.values(artifact.immutableReferences||{}))for(const {start,length} of ranges){const offset=2+start*2;result=result.slice(0,offset)+'0'.repeat(length*2)+result.slice(offset+length*2);}return result;};
    return typeof code==='string' && code.length===artifact.deployedBytecode.length && mask(code)===mask(artifact.deployedBytecode);
}
module.exports = { CHAIN_ID, ZERO, hash, lower, address, word, verified, operation, verifyTransaction, runtimeMatches };
