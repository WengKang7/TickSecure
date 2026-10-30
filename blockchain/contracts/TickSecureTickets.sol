// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Buyers submit their own approved ticket transactions. The server authorizes policy;
/// administrators manage deployment, but cannot publish a buyer's operation from an admin wallet.
contract TickSecureTickets is ERC721, Ownable, EIP712 {
    mapping(bytes32 => bytes32) public operations;
    address public authorizationSigner;
    bytes32 private constant OPERATION_TYPEHASH = keccak256("TicketOperation(bytes32 operationId,uint8 kind,uint256 tokenId,address from,address to,bytes32 recordHash,address actor,uint256 deadline)");
    struct Operation {
        bytes32 operationId; uint8 kind; uint256 tokenId; address from; address to;
        bytes32 recordHash; address actor; uint256 deadline;
    }

    event TicketOperation(bytes32 indexed operationId, uint256 indexed tokenId,
        uint8 kind, address from, address to, bytes32 recordHash);

    error InvalidOperation();
    error OperationAlreadyRecorded();
    error UseTickSecure();
    error UnauthorizedBuyer();
    error InvalidAuthorization();

    constructor(address signer) ERC721("TickSecure Ticket", "TICKET") Ownable(msg.sender) EIP712("TickSecureTickets", "2") {
        if (signer == address(0)) revert InvalidAuthorization();
        authorizationSigner = signer;
    }

    /// kind: 1 = mint, 2 = transfer, 3 = resale. Hashes contain no names, email or entry QR.
    function recordOperation(Operation calldata op, bytes calldata signature) external {
        if (op.operationId == bytes32(0) || op.recordHash == bytes32(0) || op.to == address(0)
            || op.kind < 1 || op.kind > 3) revert InvalidOperation();
        if (msg.sender != op.actor || (op.kind == 2 ? op.actor != op.from : op.actor != op.to)) revert UnauthorizedBuyer();
        if (block.timestamp > op.deadline || ECDSA.recover(_hashTypedDataV4(keccak256(abi.encode(
            OPERATION_TYPEHASH, op.operationId, op.kind, op.tokenId, op.from, op.to, op.recordHash, op.actor, op.deadline
        ))), signature) != authorizationSigner) revert InvalidAuthorization();
        if (operations[op.operationId] != bytes32(0)) revert OperationAlreadyRecorded();
        operations[op.operationId] = op.recordHash;
        if (op.kind == 1) {
            if (op.from != address(0)) revert InvalidOperation();
            _safeMint(op.to, op.tokenId);
        } else {
            _safeTransfer(op.from, op.to, op.tokenId);
        }
        emit TicketOperation(op.operationId, op.tokenId, op.kind, op.from, op.to, op.recordHash);
    }

    // Bypassing the application's transfer/resale policy would desynchronise entry ownership.
    function transferFrom(address, address, uint256) public pure override { revert UseTickSecure(); }
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override { revert UseTickSecure(); }
    function approve(address, uint256) public pure override { revert UseTickSecure(); }
    function setApprovalForAll(address, bool) public pure override { revert UseTickSecure(); }

    // Keep the issuer fixed for this version; a new deployment is an explicit migration.
    function transferOwnership(address) public pure override { revert UseTickSecure(); }
    function renounceOwnership() public pure override { revert UseTickSecure(); }
}
