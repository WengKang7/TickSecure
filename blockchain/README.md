# Organizer-managed Sepolia ticket NFTs

Buyers perform NFT transactions in MetaMask. Each verified, active organizer
deploys one contract for their own events and manages a separate demo gas wallet.
Administrators have no blockchain setup or wallet controls. Ticket payments stay
simulated: no ticket-price ETH is sent to an admin or organizer. NFT transactions
call the event organizer’s contract with zero ETH value; the buyer owns the NFT.
Network gas is separate from ticket revenue.

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
3. Open [Organizer → Blockchain Transactions](http://localhost/ticksecure-ui/organizer/blockchain.php)
   with a verified, active organizer account. Each organizer sees only their own
   event records, contract and funding wallet.
4. Connect a setup wallet with Sepolia test ETH, deploy the buyer-enabled
   contract, then verify/register its hash after two confirmations. Its
   constructor receives the backend signer's public address. Confirm a free
   wallet-control signature to bind the deployment to this organizer. A copied
   deployment hash cannot register another organizer’s contract. Repeat this
   setup for each organizer; do not deploy one contract per ticket or event.
5. Buyers open [My Tickets → My blockchain](http://localhost/ticksecure-ui/buyer/blockchain.php).
   Mint first, then process each ticket's transfers/resales in order. Booking
   confirmation links to mint records; transfer and resale receipts link to
   the responsible buyer's NFT operation.

TICKSECURE_BLOCKCHAIN_SIGNER_KEY_FILE overrides the local server key path.
Never place it in htdocs. New mints resolve the event’s organizer on the server
and require that organizer’s registered contract. There is no fallback to the
old shared admin contract. Already minted legacy NFTs, and signed in-flight
operations, retain their original contract and history; an existing NFT cannot
be moved to a new contract merely by changing its address in the database.

## Application state and recovery

### Automatic demo gas funding

Verified, active buyers can receive **0.0001 SepoliaETH once per organizer,
account and wallet** when they submit a ticket NFT operation. Connecting a
wallet alone does not allocate gas. The server derives the organizer from the
operation’s ticket and event, checks the responsible buyer, and verifies a free
`personal_sign` proof bound to the project, organizer, buyer, operation, wallet,
nonce and five-minute expiry. Browsers cannot choose an organizer to charge.
Wallets that already hold at least 0.0001 SepoliaETH skip funding.

The existing private server funding key is the root for domain-separated,
deterministic organizer wallets. Each organizer has a different public address,
balance, nonce, pending-transfer lock, claim ledger and daily budget. Their funds
are not pooled. Neither the registered organizer MetaMask nor the authorization
signer is used as the automatic sender. No MetaMask private key is requested.
Keep the root key backed up; replacing it changes every organizer funding address.

If the server root has not been configured, create it with:

```text
node scripts/setup-demo-funding.cjs --apply
```

The script never overwrites an existing key. It retains the private file outside
htdocs (`C:/xampp/private/ticksecure-demo-funding.json`, or the existing server
override). To inspect an organizer’s public address from the command line, pass
`--organizer=ORGANIZER_UID`; the normal UI is **Organizer → Blockchain
Transactions → Automatic buyer demo gas**. Send only Sepolia test ETH to the
address shown for that organizer. A small initial refill such as 0.001 SepoliaETH
limits exposure. The old shared funding wallet is not used for new grants; its
balance and old ledger are left untouched. No balance is automatically moved.

The daily cap is **0.001 SepoliaETH per organizer including maximum reserved
gas**, resetting at midnight UTC+8. Transfers estimate execution gas with a 20%
margin, a 500,000 gas limit ceiling and maximum fee of 0.1 gwei. Quotes above the
limits pause funding. Since gas counts towards the budget, fewer than ten new
0.0001 grants fit in a day. This allowance is ETH transferred to the buyer; it
is separate from the gas subsequently consumed by the buyer’s NFT transaction.

Signed transactions are persisted before broadcasting. Each organizer’s pending
slot and nonce prevent duplicate sends across processes; uncertain responses
rebroadcast the same bytes. Canonical receipts require two confirmations.
Failed transfers remain reserved and appear only in the owning organizer’s panel.
That organizer can explicitly confirm one retry after a proven failed receipt;
other organizers and admins cannot retry it. Pending or successful transfers
cannot be retried. Private keys, raw signed transactions and claim records remain
unreadable through browser Firestore access.

Apache’s existing `TICKSECURE_DEMO_FUNDING=1` flag and server-only key overrides
are retained. In deployed Functions, retain the private root in Secret Manager
`TICKSECURE_DEMO_FUNDING_KEY` and redeploy the four demo funding callables along
with the six blockchain callables. Local Apache uses the updated shared Node
implementation directly. No live transfers are performed by the unit tests.
Read-only diagnostics remain available through
`node scripts/inspect-demo-funding.cjs BUYER_PUBLIC_WALLET_ADDRESS`.

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
**0.0001 SepoliaETH** and asks the buyer to retry when fees are lower. Deployment
uses a separate **0.001 SepoliaETH** cap because it has different
execution requirements. Quotes above either cap stop before submission. Wallet
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
| BlockchainSettings/organizer_{uid} | Organizer UID, contract version 2, organizer wallet, backend signing public address, deployment hash/block and setup audit fields. |
| BlockchainDeployments/{address} | Organizer assignment; prevents two organizers registering the same deployment. |
| BlockchainSettings/sepolia | Original shared contract retained only for existing minted/in-flight legacy operations. New mints never fall back to it. |
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

    node --test tests/blockchain.test.cjs tests/organizer-chain.test.cjs tests/blockchain-admin.test.cjs tests/demo-funding.test.cjs tests/buyer-blockchain.test.cjs

The EVM test executes buyer mint, transfer and resale through the real contract
and shared backend, then verifies receipts and isolated Firestore updates.
It rejects admin/wrong-wallet submissions, forged/expired permissions, direct
wallet bypass and replay. UI tests cover cancellation, stale sessions, recovery,
buyer approvals and read-only monitoring. No live wallet or funds are used.

References: [OpenZeppelin EIP-712](https://docs.openzeppelin.com/contracts/5.x/api/utils#EIP712),
[ethers signing](https://docs.ethers.org/v6/api/wallet/),
[Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/).
