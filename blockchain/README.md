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
