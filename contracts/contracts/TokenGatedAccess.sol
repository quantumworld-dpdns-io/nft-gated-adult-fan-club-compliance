// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MembershipNFT.sol";
import "./AgeVerificationOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenGatedAccess is Ownable {
    MembershipNFT public membershipNFT;
    AgeVerificationOracle public oracle;

    mapping(uint256 => bool) private _contentTiers;
    uint256[] private _tierList;

    event ContentTierAdded(uint256 indexed contentId);
    event ContentTierRemoved(uint256 indexed contentId);
    event AccessGranted(address indexed user, uint256 indexed contentId);
    event AccessDenied(address indexed user, uint256 indexed contentId, string reason);

    constructor(address _membershipNFT, address _oracle) Ownable(msg.sender) {
        require(_membershipNFT != address(0), "Invalid NFT address");
        require(_oracle != address(0), "Invalid oracle address");
        membershipNFT = MembershipNFT(_membershipNFT);
        oracle = AgeVerificationOracle(_oracle);
    }

    function canAccess(address user, uint256 contentId) external view returns (bool) {
        if (!_contentTiers[contentId]) {
            return false;
        }

        uint256 balance = membershipNFT.balanceOf(user);
        if (balance == 0) {
            return false;
        }

        bool verified = oracle.isVerified(user);
        if (!verified) {
            return false;
        }

        return true;
    }

    function getAccessibleContentTiers(address user) external view returns (uint256[] memory) {
        uint256 balance = membershipNFT.balanceOf(user);
        bool verified = oracle.isVerified(user);

        if (balance == 0 || !verified) {
            return new uint256[](0);
        }

        uint256 count = 0;
        for (uint256 i = 0; i < _tierList.length; i++) {
            if (_contentTiers[_tierList[i]]) {
                count++;
            }
        }

        uint256[] memory accessible = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _tierList.length; i++) {
            if (_contentTiers[_tierList[i]]) {
                accessible[index] = _tierList[i];
                index++;
            }
        }

        return accessible;
    }

    function checkAccessWithReason(address user, uint256 contentId) external view returns (bool, string memory) {
        if (!_contentTiers[contentId]) {
            return (false, "Content tier does not exist");
        }

        uint256 balance = membershipNFT.balanceOf(user);
        if (balance == 0) {
            return (false, "User does not own a membership NFT");
        }

        bool verified = oracle.isVerified(user);
        if (!verified) {
            return (false, "User age verification expired or not found");
        }

        return (true, "Access granted");
    }

    function addContentTier(uint256 contentId) external onlyOwner {
        require(!_contentTiers[contentId], "Content tier already exists");
        _contentTiers[contentId] = true;
        _tierList.push(contentId);
        emit ContentTierAdded(contentId);
    }

    function removeContentTier(uint256 contentId) external onlyOwner {
        require(_contentTiers[contentId], "Content tier does not exist");
        _contentTiers[contentId] = false;

        for (uint256 i = 0; i < _tierList.length; i++) {
            if (_tierList[i] == contentId) {
                _tierList[i] = _tierList[_tierList.length - 1];
                _tierList.pop();
                break;
            }
        }

        emit ContentTierRemoved(contentId);
    }

    function isContentTierActive(uint256 contentId) external view returns (bool) {
        return _contentTiers[contentId];
    }

    function getAllContentTiers() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _tierList.length; i++) {
            if (_contentTiers[_tierList[i]]) {
                count++;
            }
        }

        uint256[] memory active = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _tierList.length; i++) {
            if (_contentTiers[_tierList[i]]) {
                active[index] = _tierList[i];
                index++;
            }
        }

        return active;
    }

    function updateMembershipNFT(address _membershipNFT) external onlyOwner {
        require(_membershipNFT != address(0), "Invalid NFT address");
        membershipNFT = MembershipNFT(_membershipNFT);
    }

    function updateOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = AgeVerificationOracle(_oracle);
    }
}
