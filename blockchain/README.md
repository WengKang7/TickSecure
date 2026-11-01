# Buyer-submitted Sepolia ticket NFTs

Buyers perform NFT transactions in MetaMask. Administrators monitor activity and
complete the one-time contract setup. Organizers view only their own events.

| Action | Wallet submitting the transaction |
| --- | --- |
| Mint an issued ticket NFT | Original purchaser |
| Transfer a ticket NFT | Ticket sender |
| Receive a resale NFT | Resale buyer |

Each buyer pays Sepolia test ETH gas and approves their wallet transaction.
The backend signs a short-lived EIP-712 permission bound to the exact operation,
buyer wallet, token, receiver, contract, chain and deadline. The contract rejects
other wallets, altered/expired permissions and replay. An admin wallet cannot
publish a buyer's operation. Buyer keys and seed phrases remain in MetaMask.

## Local activation

1. Install server dependencies with npm.cmd ci --ignore-scripts in functions.
   PHP invokes the same Node blockchain implementation as callable Functions.
   TICKSECURE_NODE_PATH overrides the Node executable path.
2. Run node scripts/setup-blockchain-authorizer.cjs --apply from the project
   root. It creates the backend permission-signing key outside htdocs at
   C:/xampp/private/ticksecure-blockchain-authorizer.json. It prints only the
   public address, never overwrites an existing key, and needs no gas funds.
   Keep this server key private and back it up.
3. Open [Admin → Blockchain](http://localhost/ticksecure-ui/admin/blockchain.php)
   with an active administrator account. Administrator email verification is
   not required. Buyers and organizers still require verified email.
4. Connect a setup wallet with Sepolia test ETH, deploy the buyer-enabled
   contract, then verify/register its hash after two confirmations. Its
   constructor receives the backend signer's public address.
5. Buyers open [My Tickets → My blockchain](http://localhost/ticksecure-ui/buyer/blockchain.php).
   Mint first, then process each ticket's transfers/resales in order. Booking
   confirmation links to mint records; transfer and resale receipts link to
   the responsible buyer's NFT operation.

TICKSECURE_BLOCKCHAIN_SIGNER_KEY_FILE overrides the local server key path.
Never place it in htdocs. If an earlier admin-published contract was already
registered, an explicit migration is needed. The app does not replace it or
erase its history.

## Application state and recovery

### Automatic demo gas funding

Verified, active buyers receive a one-time allowance of **0.002 SepoliaETH** when
they connect/save and prove control of a standard MetaMask wallet. The browser
requests a readable `personal_sign` challenge bound to the project, buyer UID,
wallet, chain, random nonce and five-minute expiry. This is a gas-free wallet
proof, not permission to spend assets. The backend verifies the signature and
profile again inside the allocation transaction. A wallet cannot claim through
multiple accounts, and changing wallets does not reset an account's allowance.

Create the separate local funding wallet with:

```text
node scripts/setup-demo-funding.cjs --apply
```

It writes `C:/xampp/private/ticksecure-demo-funding.json` by default, prints only
the public address, and never overwrites existing keys. Send **Sepolia test ETH
only** to that address, for example 0.05 SepoliaETH for a small demonstration.
The administrator's existing MetaMask remains their own wallet; no MetaMask key
is requested or copied. Neither the NFT authorization signer nor the registered
contract administrator wallet can serve as the funding wallet. The deployed
ticket contract does not change or need redeployment.

Apache's `.htaccess` enables `TICKSECURE_DEMO_FUNDING=1` locally. The funding key
can be overridden by server-only `TICKSECURE_DEMO_FUNDING_KEY_FILE`. Set the flag
to `0` in the effective server configuration to disable new funding. Node reads
the private file outside htdocs. Private keys, signed transfers, challenge
documents and claim ledgers are never available through browser Firestore reads.
Apache request-local funding settings are forwarded to the Node bridge.

On **Admin → Blockchain**, Automatic buyer demo gas shows the public treasury
address, balance and today's reserved budget. **Buyer → Wallet** requests funding
after connection, with progress/cancellation messages. Fresh checkout minting
and manual NFT operations also offer the allowance to previously connected
buyers whose wallet lacks a small gas balance. Already funded wallets can use
NFT operations without depending on the funding service.

The hard daily budget is **0.02 SepoliaETH including maximum reserved gas**, using
UTC+8 calendar days. Native transfers use a live gas estimate plus a 20% safety
margin, with a 500,000 execution-gas cap and an economical tip. Do not assume
21,000 gas: first-time account funding can require substantially more gas on
the current testnet. The full estimated allowance is included in reservations;
the maximum fee is capped at 0.1 gwei. Fees above the cap pause funding. Because
the budget includes gas, it allows fewer than ten full 0.002 allowances per day.
Budget reservations are deliberately retained on failure and across retries.
This is a bounded FYP allowance, not unlimited automatic wallet refilling.
This allowance is a transfer to the buyer, not gas consumed by the network.
Existing claims keep their recorded amounts; pending transfers retain their
original signed bytes and old allowances are not automatically sent again.
Changing the allowance invalidates unclaimed challenges for the previous amount.

Claims persist a signed raw transaction, nonce and deterministic hash in one
Firestore transaction **before** broadcasting. A single pending transfer and
persisted next nonce serialize the treasury across PHP/Functions processes.
Retries rebroadcast identical bytes and confirm the same hash; they never create
a second allowance. Success requires a canonical receipt and two confirmations.
A reverted transfer keeps that allowance reserved and needs administrator review.
The admin funding panel lists failed grants and offers one explicitly confirmed
**Retry failed funding** action. The backend requires a canonical failed receipt
with two confirmations, rechecks buyer eligibility and daily budget, and signs a
new transfer with a fresh estimated gas limit and nonce. Its previous failed hash
is retained. Pending/unknown/successful transfers cannot be retried through this
action, and no grant can receive more than one administrative retry. Buyers do
not trigger this retry automatically. The browser stops NFT submission when demo
funding is FAILED instead of continuing to a misleading insufficient-gas error.
An uncertain/pending transfer keeps its budget/nonce reserved and pauses new
transfers until reconciled. Keep these private ledger records in backups.

In deployed Functions, configure the separate Secret Manager secret
`TICKSECURE_DEMO_FUNDING_KEY` and the environment flag before deploying
`getDemoFundingSettings`, `getDemoFundingChallenge`, `claimDemoFunding`, and
`retryDemoFunding`.
This setup does not deploy anything. Do not enable public automatic funding
without reviewing abuse controls and the intentionally small server-side caps.
No live funding transfer is performed by the unit tests.

For read-only local diagnostics, run
`node scripts/inspect-demo-funding.cjs BUYER_PUBLIC_WALLET_ADDRESS`. It reads the
claim and public receipt/balances/transfer estimate without returning credentials,
signatures or raw transfers, modifying Firestore, or broadcasting anything.

### Economy gas fees

The shared MetaMask sender requests the 10th-percentile priority-fee rewards
from five recent Sepolia blocks and uses their median. It keeps the tip between
0.001 and 0.01 gwei, with a maximum fee per gas of twice the projected next-block
base fee plus that tip. These are economy suggestions; MetaMask can display or
allow the buyer to change them, and a low tip can take longer to confirm.
Actual cost is gas used times the effective gas price, not the full maximum.
No fixed SepETH amount or guaranteed minimum fee is promised.
Before opening MetaMask for an NFT operation, the app also checks the quoted
maximum (buffered gas limit times maximum fee per gas). It pauses requests above
**0.0001 SepoliaETH** and asks the buyer to retry when fees are lower. This cap
does not apply to deployment, which has different execution requirements. Wallet
fee edits remain under the user's control. The policy favors economy over speed.

Transactions are simulated with `eth_estimateGas` before wallet submission.
A 20% gas-limit allowance avoids cutting execution short; unused gas is not
spent. Missing fee data and failed simulations stop before submission rather
than silently using an expensive fallback. The existing contract and artifact
are unchanged, so an already registered deployment remains valid. This does
not batch NFTs: the registered contract still requires one transaction per
ticket operation. Reusing known hashes for verification avoids duplicate sends.

After a successful checkout, the booking confirmation automatically starts the
new booking's ticket NFT mint requests. Buyers do not need to open My blockchain
or click Mint for each new ticket. MetaMask still requires the buyer's approval
and Sepolia test ETH for each transaction; multiple tickets are processed in
sequence, waiting for confirmation before requesting the next one. Checkout
explains these requests before purchase. The server wallet does not submit or
pay for buyer operations.

Opening an old booking confirmation or reloading it does not automatically ask
for another wallet approval. A cancelled request, missing setup, or unavailable
provider keeps the booking confirmed and offers Continue NFT setup. Submitted
hashes use the same local recovery storage as My blockchain, so continuation
verifies a known hash rather than resubmitting. NFT details remains available
for manual recovery and for existing transfer/resale operations. Browser Web
Locks serialize automatic and manual NFT requests for the same buyer across
tabs when supported.

The existing Firebase booking, handover and simulated resale payment workflows
queue separate NFT work. Application ownership can be ahead of chain ownership
until the responsible buyer approves and confirms the NFT operation. The buyer
page states this explicitly. No real ticket payments are collected.

The buyer reviews a custom confirmation, selects the recorded wallet and
approves MetaMask. The backend verifies contract runtime, authorization,
submitting wallet, zero ETH value, exact calldata, canonical receipt and matching
ticket event. Confirmation requires two blocks. A reverted transaction is saved
as failed and never marks a ticket minted.

Browser storage retains submitted hashes. Buyers can also select their record
and paste a hash from MetaMask under Recover a submitted transaction.
Verification never sends another transaction. Copying another buyer's wallet
address into a profile grants no access to that buyer's operations.

## Firebase records

| Document | Fields |
| --- | --- |
| BlockchainTransactions/{id} | actorUid, actorWallet, real transactionHash, status, chainId, contractAddress, tokenId, operationId, recordHash, block/confirmation metadata. verificationVersion 2 identifies this buyer-authorized model. |
| NFTTickets/{id} | Original mint hash in transactionHash; mintingStatus MINTED, token/contract/chain fields; latest confirmed operation in blockchainLastTransactionHash and its recorded wallet. |
| BlockchainSettings/sepolia | Contract version 2, contract administrator, backend signing public address, deployment hash/block and setup audit fields. |
| BlockchainAuthorizations/{calldataHash} | Backend-only permission snapshot bound to the responsible buyer and exact calldata. Multiple permissions support safe recovery when an earlier approval expires. |

recordHash is a SHA-256 commitment; transactionHash is the real Ethereum
transaction identifier returned by MetaMask and verified through RPC.
Names, emails, seat details and entry QR data are not included in the chain call.

Browser writes to protected ticket/blockchain records remain denied. Settings
and authorizations retain the default-deny policy. Buyer and organizer views
use backend allowlists. No new composite index or widened browser rule is needed.

## Functions / provider setup

Local Apache uses TICKSECURE_PHP_BLOCKCHAIN=1. PHP verifies the ID token and
passes the trusted caller identity to the shared Node service using the private
Firebase service account. Role and operation ownership are checked again there.

For callable Functions, configure TICKSECURE_BLOCKCHAIN_SIGNER_KEY in Firebase
Secret Manager before deployment. Use the same signing key as the registered
contract; key rotation requires a deliberate migration. Emulator configuration
may use a private key file or its supported secret override. Never commit keys
or secret override files.

Deploy the six blockchain callables and changed ticket queue writers:

    firebase deploy --only functions:getBlockchainSettings,functions:configureBlockchain,functions:prepareBlockchainOperation,functions:verifyBlockchainOperation,functions:getBuyerBlockchainOperations,functions:getOrganizerBlockchainOperations,functions:checkout,functions:transferTicket,functions:purchaseResale

Restart the Functions emulator instead when appropriate.
TICKSECURE_SEPOLIA_RPC_URL overrides the default PublicNode HTTPS provider.
Only Sepolia chain ID 11155111 is accepted.

## Build and tests

In the blockchain directory, run npm.cmd ci --ignore-scripts, npm.cmd run compile,
then npm.cmd test. The public ABI/bytecode artifact is generated in functions.
From the project root:

    node --test tests/blockchain.test.cjs tests/blockchain-admin.test.cjs tests/buyer-blockchain.test.cjs

The EVM test executes buyer mint, transfer and resale through the real contract
and shared backend, then verifies receipts and isolated Firestore updates.
It rejects admin/wrong-wallet submissions, forged/expired permissions, direct
wallet bypass and replay. UI tests cover cancellation, stale sessions, recovery,
buyer approvals and read-only monitoring. No live wallet or funds are used.

References: [OpenZeppelin EIP-712](https://docs.openzeppelin.com/contracts/5.x/api/utils#EIP712),
[ethers signing](https://docs.ethers.org/v6/api/wallet/),
[Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/).
