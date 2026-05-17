// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgeVerificationOracle is Ownable {
    struct Verification {
        bytes32 proofHash;
        uint256 expiry;
        bool exists;
    }

    address public verifier;

    mapping(address => Verification) private _verifications;

    event VerificationSubmitted(address indexed user, bytes32 proofHash, uint256 expiry);
    event VerificationExpired(address indexed user);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    modifier onlyVerifier() {
        require(msg.sender == verifier || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function submitVerification(address user, bytes32 proofHash, uint256 expiry) external onlyVerifier {
        require(user != address(0), "Invalid user address");
        require(proofHash != bytes32(0), "Invalid proof hash");
        require(expiry > block.timestamp, "Expiry must be in the future");

        _verifications[user] = Verification({
            proofHash: proofHash,
            expiry: expiry,
            exists: true
        });

        emit VerificationSubmitted(user, proofHash, expiry);
    }

    function isVerified(address user) external view returns (bool) {
        Verification storage v = _verifications[user];
        return v.exists && v.expiry > block.timestamp;
    }

    function getVerificationExpiry(address user) external view returns (uint256) {
        Verification storage v = _verifications[user];
        require(v.exists, "No verification record");
        return v.expiry;
    }

    function getVerificationProof(address user) external view returns (bytes32) {
        Verification storage v = _verifications[user];
        require(v.exists, "No verification record");
        return v.proofHash;
    }

    function refreshVerification(address user, bytes32 proofHash, uint256 newExpiry) external onlyVerifier {
        require(_verifications[user].exists, "No existing verification");
        require(newExpiry > block.timestamp, "Expiry must be in the future");

        _verifications[user].proofHash = proofHash;
        _verifications[user].expiry = newExpiry;

        emit VerificationSubmitted(user, proofHash, newExpiry);
    }

    function expireVerification(address user) external onlyVerifier {
        require(_verifications[user].exists, "No verification record");

        _verifications[user].expiry = block.timestamp;

        emit VerificationExpired(user);
    }

    function setVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "Invalid verifier address");
        address oldVerifier = verifier;
        verifier = newVerifier;
        emit VerifierUpdated(oldVerifier, newVerifier);
    }
}
