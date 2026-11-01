import { invokeTrustedBackend } from './backend-client.js?v=20261101-demo-funding';
const el = id => document.getElementById(id);
let generation = 0;
let retrying = false;
async function refreshFunding() {
    const version = ++generation, user = window.tsCurrentUser;
    el('demo-funding-details').hidden = true;
    el('demo-funding-failures').replaceChildren();
    if (user?.role !== 'admin' || user.status !== 'active') return;
    el('demo-funding-message').textContent = 'Loading demo funding wallet...';
    try {
        const result = await invokeTrustedBackend({}, { name: 'getDemoFundingSettings', region: 'asia-southeast1' });
        if (version !== generation || window.tsCurrentUser?.uid !== user.uid) return;
        if (!result.configured) { el('demo-funding-message').textContent = 'Automatic demo gas funding needs its separate server wallet configured.'; return; }
        el('demo-funding-message').textContent = `Send only Sepolia test ETH to this dedicated wallet. Eligible verified buyers receive ${result.amount} SepoliaETH once per account and wallet. Daily budget: ${result.dailyLimit} SepoliaETH including gas, reset at midnight UTC+8. Buyers approve a wallet verification signature first.`;
        el('demo-funding-address').textContent = result.fundingWallet;
        el('demo-funding-balance').textContent = (Number(result.balanceWei) / 1e18).toFixed(6) + ' SepoliaETH';
        el('demo-funding-budget').textContent = (Number(result.reservedWei) / 1e18).toFixed(6) + ` / ${result.dailyLimit} SepoliaETH`;
        el('demo-funding-details').hidden = false;
        for (const claim of result.failedClaims || []) {
            const row = document.createElement('div'); row.className = 'ts-list-item';
            const text = document.createElement('p'); text.className = 'small secondary';
            text.textContent = `Failed demo gas transfer to ${claim.walletAddress}. ${claim.retryAvailable ? 'One administrator-approved retry is available.' : 'The retry limit has been reached; review is required.'}`;
            row.appendChild(text);
            if (claim.retryAvailable) {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'ts-btn ts-btn-secondary ts-btn-sm'; button.textContent = 'Retry failed funding';
                button.disabled = retrying;
                button.addEventListener('click', async () => {
                    if (retrying || version !== generation || window.tsCurrentUser?.uid !== user.uid) return;
                    retrying = true; button.disabled = true;
                    try {
                        if (!await window.tsConfirmDecision({ requireAdmin: true, title: 'Retry failed demo gas funding?', label: 'Retry funding', subject: claim.walletAddress,
                            message: 'The backend will verify that the previous transfer failed, then submit one new Sepolia test-ETH transfer using a fresh gas estimate. Its amount and maximum gas are reserved against the daily budget.', details: [['Allowance', `${result.amount} SepoliaETH`], ['Previous transaction', claim.transactionHash]] })) return;
                        if (version !== generation || window.tsCurrentUser?.uid !== user.uid) return;
                        await invokeTrustedBackend({ claimId: claim.claimId }, { name: 'retryDemoFunding', region: 'asia-southeast1' });
                        await refreshFunding();
                        el('demo-funding-message').textContent = 'Funding retry submitted. Wait for confirmation, then return to the buyer and retry the NFT operation. A pending transfer will not be replaced again.';
                    } catch (error) { if (version === generation) el('demo-funding-message').textContent = error.message || 'Funding retry could not be submitted.'; }
                    finally { retrying = false; button.disabled = false; }
                });
                row.appendChild(button);
            }
            el('demo-funding-failures').appendChild(row);
        }
    } catch (_) { if (version === generation) el('demo-funding-message').textContent = 'Demo funding status is unavailable. Refresh to try again.'; }
}
el('demo-funding-refresh').addEventListener('click', refreshFunding);
window.addEventListener('ts-auth-ready', refreshFunding);
window.addEventListener('pagehide', () => { generation++; });
if (window.tsCurrentUser?.uid) refreshFunding();
