import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { Interface } from 'ethers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = {
    language: 'Solidity',
    sources: { 'TickSecureTickets.sol': { content: fs.readFileSync(path.join(root, 'contracts/TickSecureTickets.sol'), 'utf8') } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun',
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences'] } } }
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: name => {
    if (!name.startsWith('@openzeppelin/contracts/') || name.includes('..')) return { error: 'Unsupported import' };
    return { contents: fs.readFileSync(path.join(root, 'node_modules', name), 'utf8') };
} }));
for (const error of output.errors || []) console.error(error.formattedMessage);
if ((output.errors || []).some(error => error.severity === 'error')) process.exit(1);
const contract = output.contracts['TickSecureTickets.sol'].TickSecureTickets;
const iface = new Interface(contract.abi);
const artifact = { compiler: solc.version(), contractName: 'TickSecureTickets', abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object, deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
    immutableReferences: contract.evm.deployedBytecode.immutableReferences,
    selectors: Object.fromEntries(['recordOperation', 'operations', 'owner', 'ownerOf', 'authorizationSigner'].map(name => [name, iface.getFunction(name).selector])),
    eventTopic: iface.getEvent('TicketOperation').topicHash };
fs.writeFileSync(path.join(root, '../functions/blockchain-ticket-artifact.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(`Compiled ${artifact.contractName}; ${artifact.deployedBytecode.length / 2 - 1} runtime bytes.`);
