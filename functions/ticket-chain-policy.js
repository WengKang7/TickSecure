'use strict';
const policy = require('./blockchain-policy');

// Run inside the ownership-changing transaction, before any writes. Reading the
// ticket and its history together serializes concurrent handovers of one NFT.
async function requireConfirmedTicket(tx, db, ticketId, ticket, fail) {
    const contract = policy.lower(ticket.contractAddress);
    let ready = ticket.mintingStatus === 'MINTED' && ticket.blockchainStatus === 'CONFIRMED'
        && ticket.chainId === 11155111 && policy.address(contract) && policy.address(ticket.walletAddress)
        && policy.lower(ticket.walletAddress) === policy.lower(ticket.blockchainWalletAddress)
        && /^0x[0-9a-fA-F]{64}$/.test(ticket.transactionHash || '');
    const history = await tx.get(db.collection('BlockchainTransactions').where('ticketId', '==', ticketId));
    let minted = false;
    for (const snap of history.docs) {
        const operation = snap.data();
        minted ||= operation.transactionType === 'MINT';
        if (!policy.verified(operation, { contractAddress: contract })
            || !/^0x[0-9a-fA-F]{64}$/.test(operation.transactionHash || '')) ready = false;
    }
    if (!ready || !minted) fail('failed-precondition',
        'Complete and verify all NFT transactions for this ticket before transferring or selling it.');
}
module.exports = { requireConfirmedTicket };
