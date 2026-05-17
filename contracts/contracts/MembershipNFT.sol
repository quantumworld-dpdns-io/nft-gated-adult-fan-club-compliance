// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/workspace/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MembershipNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    enum Tier { BASIC, PREMIUM, VIP }

    struct Membership {
        Tier tier;
        uint256 mintedAt;
        uint256 upgradedAt;
    }

    uint256 public constant BASIC_PRICE = 0.1 ether;
    uint256 public constant PREMIUM_PRICE = 0.5 ether;
    uint256 public constant VIP_PRICE = 1.0 ether;

    mapping(uint256 => Membership) private _memberships;
    mapping(address => uint256[]) private _userTokens;

    event MembershipMinted(address indexed user, uint256 indexed tokenId, Tier tier, uint256 price);
    event TierUpgraded(address indexed user, uint256 indexed tokenId, Tier oldTier, Tier newTier);
    event MembershipRevoked(address indexed user, uint256 indexed tokenId, Tier tier);

    constructor() ERC721("FanClub Membership", "FCM") Ownable(msg.sender) {}

    function mint(Tier tier) external payable nonReentrant returns (uint256) {
        require(tier == Tier.BASIC || tier == Tier.PREMIUM || tier == Tier.VIP, "Invalid tier");

        uint256 price = _getPrice(tier);
        require(msg.value >= price, "Insufficient payment");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);

        _memberships[newTokenId] = Membership({
            tier: tier,
            mintedAt: block.timestamp,
            upgradedAt: 0
        });

        _userTokens[msg.sender].push(newTokenId);

        _setTokenURI(newTokenId, _generateTierURI(tier));

        emit MembershipMinted(msg.sender, newTokenId, tier, price);

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }

        return newTokenId;
    }

    function upgradeTier(uint256 tokenId, Tier newTier) external payable nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!_isRevoked(tokenId), "Membership revoked");

        Membership storage membership = _memberships[tokenId];
        require(newTier > membership.tier, "Can only upgrade to higher tier");

        uint256 currentPrice = _getPrice(membership.tier);
        uint256 newPrice = _getPrice(newTier);
        uint256 upgradeCost = newPrice - currentPrice;

        require(msg.value >= upgradeCost, "Insufficient upgrade payment");

        Tier oldTier = membership.tier;
        membership.tier = newTier;
        membership.upgradedAt = block.timestamp;

        _setTokenURI(tokenId, _generateTierURI(newTier));

        emit TierUpgraded(msg.sender, tokenId, oldTier, newTier);

        uint256 excess = msg.value - upgradeCost;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }
    }

    function revokeMembership(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        address user = ownerOf(tokenId);
        Tier tier = _memberships[tokenId].tier;

        _burn(tokenId);
        delete _memberships[tokenId];

        emit MembershipRevoked(user, tokenId, tier);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return super.tokenURI(tokenId);
    }

    function getMembership(uint256 tokenId) external view returns (Membership memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _memberships[tokenId];
    }

    function getUserTokens(address user) external view returns (uint256[] memory) {
        return _userTokens[user];
    }

    function getUserActiveTokens(address user) external view returns (uint256[] memory) {
        uint256[] storage tokens = _userTokens[user];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            if (_ownerOf(tokens[i]) == user) {
                activeCount++;
            }
        }

        uint256[] memory activeTokens = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (_ownerOf(tokens[i]) == user) {
                activeTokens[index] = tokens[i];
                index++;
            }
        }

        return activeTokens;
    }

    function balanceOf(address owner) public view override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for zero address");
        return super.balanceOf(owner);
    }

    function _getPrice(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.BASIC) return BASIC_PRICE;
        if (tier == Tier.PREMIUM) return PREMIUM_PRICE;
        if (tier == Tier.VIP) return VIP_PRICE;
        revert("Invalid tier");
    }

    function _generateTierURI(Tier tier) internal pure returns (string memory) {
        if (tier == Tier.BASIC) return "ipfs://basic-tier-metadata";
        if (tier == Tier.PREMIUM) return "ipfs://premium-tier-metadata";
        if (tier == Tier.VIP) return "ipfs://vip-tier-metadata";
        return "ipfs://default-metadata";
    }

    function _isRevoked(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) == address(0);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert("MembershipNFT: soulbound - transfers are not allowed");
        }

        return super._update(to, tokenId, auth);
    }

    receive() external payable {}

    fallback() external payable {}
}
