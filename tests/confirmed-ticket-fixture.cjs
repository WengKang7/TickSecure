// A real-looking, fully verified starting point for handover policy tests.
module.exports = function confirmedTicket(records, ticketId = 'ticket') {
    const ticket = records['NFTTickets/' + ticketId];
    const contractAddress = '0x' + '4'.repeat(40), transactionHash = '0x' + 'a'.repeat(64);
    Object.assign(ticket, { mintingStatus: 'MINTED', blockchainStatus: 'CONFIRMED', chainId: 11155111,
        contractAddress, transactionHash, blockchainWalletAddress: ticket.walletAddress });
    records['BlockchainTransactions/confirmed-mint-' + ticketId] = { ticketId, transactionType: 'MINT',
        status: 'CONFIRMED', verificationVersion: 2, chainId: 11155111, contractAddress, transactionHash,
        walletAddress: ticket.walletAddress, timestamp: '2026-01-01T00:00:00.000Z' };
    return records;
};
