// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceRegistry is Ownable {
    struct ComplianceCheck {
        address user;
        bytes32 checkHash;
        string checkType;
        uint256 timestamp;
    }

    address public trustedForwarder;

    ComplianceCheck[] private _allChecks;
    mapping(address => uint256[]) private _userCheckIndices;
    mapping(bytes32 => bool) private _checkHashes;

    uint256 public totalChecks;

    event ComplianceCheckRecorded(
        address indexed user,
        bytes32 indexed checkHash,
        string checkType,
        uint256 timestamp,
        uint256 indexed checkId
    );

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || msg.sender == trustedForwarder,
            "Not authorized"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    function recordCheck(
        address user,
        bytes32 checkHash,
        string memory checkType,
        uint256 timestamp
    ) external onlyAuthorized returns (uint256) {
        require(user != address(0), "Invalid user address");
        require(checkHash != bytes32(0), "Invalid check hash");
        require(bytes(checkType).length > 0, "Invalid check type");
        require(timestamp <= block.timestamp, "Timestamp cannot be in the future");
        require(!_checkHashes[checkHash], "Duplicate check hash");

        uint256 checkId = _allChecks.length;

        _allChecks.push(ComplianceCheck({
            user: user,
            checkHash: checkHash,
            checkType: checkType,
            timestamp: timestamp
        }));

        _userCheckIndices[user].push(checkId);
        _checkHashes[checkHash] = true;
        totalChecks++;

        emit ComplianceCheckRecorded(user, checkHash, checkType, timestamp, checkId);

        return checkId;
    }

    function getCheckHistory(address user) external view returns (ComplianceCheck[] memory) {
        uint256[] storage indices = _userCheckIndices[user];
        ComplianceCheck[] memory history = new ComplianceCheck[](indices.length);

        for (uint256 i = 0; i < indices.length; i++) {
            history[i] = _allChecks[indices[i]];
        }

        return history;
    }

    function getCheck(uint256 checkId) external view returns (ComplianceCheck memory) {
        require(checkId < _allChecks.length, "Check does not exist");
        return _allChecks[checkId];
    }

    function getCheckCount() external view returns (uint256) {
        return _allChecks.length;
    }

    function getUserCheckCount(address user) external view returns (uint256) {
        return _userCheckIndices[user].length;
    }

    function isCheckRecorded(bytes32 checkHash) external view returns (bool) {
        return _checkHashes[checkHash];
    }

    function getUserChecksPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (ComplianceCheck[] memory) {
        uint256[] storage indices = _userCheckIndices[user];
        uint256 total = indices.length;

        if (offset >= total) {
            return new ComplianceCheck[](0);
        }

        uint256 resultSize = limit;
        if (offset + limit > total) {
            resultSize = total - offset;
        }

        ComplianceCheck[] memory page = new ComplianceCheck[](resultSize);
        for (uint256 i = 0; i < resultSize; i++) {
            page[i] = _allChecks[indices[offset + i]];
        }

        return page;
    }

    function setTrustedForwarder(address forwarder) external onlyOwner {
        require(forwarder != address(0), "Invalid forwarder address");
        trustedForwarder = forwarder;
    }

    function revokeTrustedForwarder() external onlyOwner {
        trustedForwarder = address(0);
    }
}
