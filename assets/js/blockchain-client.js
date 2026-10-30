import { invokeTrustedBackend } from './backend-client.js?v=20261030-buyer-chain-v2';
export const sepolia = {
    listBuyer: filters => invokeTrustedBackend(filters || {}, { name:'getBuyerBlockchainOperations',region:'asia-southeast1' }),
    listOrganizer: filters => invokeTrustedBackend(filters || {}, { name:'getOrganizerBlockchainOperations',region:'asia-southeast1' }),
    getSettings: () => invokeTrustedBackend({}, { name:'getBlockchainSettings',region:'asia-southeast1' }),
    configure: transactionHash => invokeTrustedBackend({transactionHash}, { name:'configureBlockchain',region:'asia-southeast1' }),
    prepare: recordId => invokeTrustedBackend({recordId}, { name:'prepareBlockchainOperation',region:'asia-southeast1' }),
    verify: (recordId,transactionHash) => invokeTrustedBackend({recordId,transactionHash}, { name:'verifyBlockchainOperation',region:'asia-southeast1' })
};
