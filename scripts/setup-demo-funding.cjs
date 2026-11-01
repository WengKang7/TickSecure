'use strict';
// Generates a separate empty Sepolia funding wallet, never reads MetaMask keys.
const fs = require('node:fs'), path = require('node:path');
const { Wallet } = require('../functions/node_modules/ethers');
const { AMOUNT, DAILY_LIMIT } = require('../functions/demo-funding');
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
    const wallet = new Wallet(JSON.parse(fs.readFileSync(file, 'utf8')).privateKey);
    process.stdout.write(JSON.stringify({ configured: true, fundingWallet: wallet.address.toLowerCase(), network: 'Sepolia',
        allowance: `${formatEther(AMOUNT)} SepoliaETH once per account and wallet`, dailyBudget: `${formatEther(DAILY_LIMIT)} SepoliaETH including gas (UTC+8)`,
        nextStep: 'Send Sepolia test ETH to this public address. Never send real assets. Existing keys are never overwritten.' }));
} catch (_) { process.stderr.write('Demo funding setup failed. Check the private directory and key configuration. No key is printed or overwritten.\n'); process.exitCode = 1; }
