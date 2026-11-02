'use strict';
// Generates a separate empty Sepolia funding wallet, never reads MetaMask keys.
const fs = require('node:fs'), path = require('node:path');
const { Wallet } = require('../functions/node_modules/ethers');
const { organizerWallet, AMOUNT, DAILY_LIMIT } = require('../functions/demo-funding');
const { formatEther } = require('../functions/node_modules/ethers');
try {
    const file = path.resolve(process.env.TICKSECURE_DEMO_FUNDING_KEY_FILE || 'C:/xampp/private/ticksecure-demo-funding.json');
    const webroot = fs.realpathSync(path.resolve(__dirname, '../..'));
    const outside = target => !target.toLowerCase().startsWith(webroot.toLowerCase() + path.sep) && target.toLowerCase() !== webroot.toLowerCase();
    if (!outside(file)) throw Error();
    if (!fs.existsSync(file)) {
        if (!process.argv.includes('--apply')) {
            process.stdout.write(JSON.stringify({ configured: false, nextStep: 'Run with --apply to create an empty dedicated demo funding wallet outside htdocs.' }));
            process.exit(0);
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (!outside(fs.realpathSync(path.dirname(file)))) throw Error();
        fs.writeFileSync(file, JSON.stringify({ privateKey: Wallet.createRandom().privateKey, createdAt: new Date().toISOString() }, null, 2), { flag: 'wx', mode: 0o600 });
    }
    if (!outside(fs.realpathSync(file))) throw Error();
    const rootKey = JSON.parse(fs.readFileSync(file, 'utf8')).privateKey;
    const organizerUid = process.argv.find(value => value.startsWith('--organizer='))?.slice('--organizer='.length);
    const wallet = organizerUid ? organizerWallet(rootKey, organizerUid) : null;
    process.stdout.write(JSON.stringify({ configured: true, ...(wallet ? {organizerUid,fundingWallet:wallet.address.toLowerCase()} : {}), network: 'Sepolia',
        allowance: `${formatEther(AMOUNT)} SepoliaETH once per organizer, account and wallet`, dailyBudget: `${formatEther(DAILY_LIMIT)} SepoliaETH per organizer including gas (UTC+8)`,
        nextStep: 'Open Organizer > Blockchain Transactions to see that organizer funding address, or supply --organizer=UID. The old shared address is no longer used for new grants. Existing keys are never overwritten.' }));
} catch (_) { process.stderr.write('Demo funding setup failed. Check the private directory and key configuration. No key is printed or overwritten.\n'); process.exitCode = 1; }
