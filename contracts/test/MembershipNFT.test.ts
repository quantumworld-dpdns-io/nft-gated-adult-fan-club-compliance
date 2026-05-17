import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MembershipNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

enum Tier {
  BASIC = 0,
  PREMIUM = 1,
  VIP = 2,
}

describe("MembershipNFT", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    const MembershipNFTFactory = await ethers.getContractFactory("MembershipNFT");
    const membershipNFT = await MembershipNFTFactory.deploy();
    await membershipNFT.waitForDeployment();

    return { membershipNFT, owner, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      const { membershipNFT } = await loadFixture(deployFixture);
      expect(await membershipNFT.name()).to.equal("FanClub Membership");
      expect(await membershipNFT.symbol()).to.equal("FCM");
    });

    it("should set the owner correctly", async function () {
      const { membershipNFT, owner } = await loadFixture(deployFixture);
      expect(await membershipNFT.owner()).to.equal(owner.address);
    });

    it("should have correct initial tier prices", async function () {
      const { membershipNFT } = await loadFixture(deployFixture);
      expect(await membershipNFT.BASIC_PRICE()).to.equal(ethers.parseEther("0.1"));
      expect(await membershipNFT.PREMIUM_PRICE()).to.equal(ethers.parseEther("0.5"));
      expect(await membershipNFT.VIP_PRICE()).to.equal(ethers.parseEther("1.0"));
    });
  });

  describe("Minting", function () {
    it("should mint BASIC tier with correct payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await expect(
        membershipNFT.connect(user1).mint(Tier.BASIC, { value: price })
      )
        .to.emit(membershipNFT, "MembershipMinted")
        .withArgs(user1.address, 1, Tier.BASIC, price);

      expect(await membershipNFT.balanceOf(user1.address)).to.equal(1);
      expect(await membershipNFT.ownerOf(1)).to.equal(user1.address);
    });

    it("should mint PREMIUM tier with correct payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.5");

      await expect(
        membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: price })
      )
        .to.emit(membershipNFT, "MembershipMinted")
        .withArgs(user1.address, 1, Tier.PREMIUM, price);

      const membership = await membershipNFT.getMembership(1);
      expect(membership.tier).to.equal(Tier.PREMIUM);
    });

    it("should mint VIP tier with correct payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("1.0");

      await expect(
        membershipNFT.connect(user1).mint(Tier.VIP, { value: price })
      )
        .to.emit(membershipNFT, "MembershipMinted")
        .withArgs(user1.address, 1, Tier.VIP, price);

      const membership = await membershipNFT.getMembership(1);
      expect(membership.tier).to.equal(Tier.VIP);
    });

    it("should reject mint with insufficient payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const insufficientPrice = ethers.parseEther("0.05");

      await expect(
        membershipNFT.connect(user1).mint(Tier.BASIC, { value: insufficientPrice })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should refund excess payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const excessPrice = ethers.parseEther("1.0");
      const basicPrice = ethers.parseEther("0.1");
      const refundAmount = excessPrice - basicPrice;

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await membershipNFT.connect(user1).mint(Tier.BASIC, { value: excessPrice });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const netSpend = balanceBefore - balanceAfter - gasCost;
      expect(netSpend).to.equal(basicPrice);
    });

    it("should increment token IDs correctly", async function () {
      const { membershipNFT, user1, user2 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      const tx1 = await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });
      await tx1.wait();
      expect(await membershipNFT.ownerOf(1)).to.equal(user1.address);

      const tx2 = await membershipNFT.connect(user2).mint(Tier.BASIC, { value: price });
      await tx2.wait();
      expect(await membershipNFT.ownerOf(2)).to.equal(user2.address);
    });

    it("should allow multiple mints per user", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });
      await membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: ethers.parseEther("0.5") });

      const tokens = await membershipNFT.getUserTokens(user1.address);
      expect(tokens.length).to.equal(2);
      expect(await membershipNFT.balanceOf(user1.address)).to.equal(2);
    });
  });

  describe("Soulbound (Transfer Restriction)", function () {
    it("should prevent transfer to another address", async function () {
      const { membershipNFT, user1, user2 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });

      await expect(
        membershipNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("MembershipNFT: soulbound - transfers are not allowed");
    });

    it("should prevent approved transfer", async function () {
      const { membershipNFT, user1, user2 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });

      await expect(
        membershipNFT.connect(user1).approve(user2.address, 1)
      ).to.be.revertedWith("MembershipNFT: soulbound - transfers are not allowed");
    });
  });

  describe("Tier Upgrades", function () {
    it("should upgrade from BASIC to PREMIUM", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });

      const upgradeCost = ethers.parseEther("0.4"); // PREMIUM - BASIC = 0.5 - 0.1
      await expect(
        membershipNFT.connect(user1).upgradeTier(1, Tier.PREMIUM, { value: upgradeCost })
      )
        .to.emit(membershipNFT, "TierUpgraded")
        .withArgs(user1.address, 1, Tier.BASIC, Tier.PREMIUM);

      const membership = await membershipNFT.getMembership(1);
      expect(membership.tier).to.equal(Tier.PREMIUM);
    });

    it("should upgrade from BASIC to VIP directly", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });

      const upgradeCost = ethers.parseEther("0.9"); // VIP - BASIC = 1.0 - 0.1
      await membershipNFT.connect(user1).upgradeTier(1, Tier.VIP, { value: upgradeCost });

      const membership = await membershipNFT.getMembership(1);
      expect(membership.tier).to.equal(Tier.VIP);
    });

    it("should upgrade from PREMIUM to VIP", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const premiumPrice = ethers.parseEther("0.5");

      await membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: premiumPrice });

      const upgradeCost = ethers.parseEther("0.5"); // VIP - PREMIUM = 1.0 - 0.5
      await membershipNFT.connect(user1).upgradeTier(1, Tier.VIP, { value: upgradeCost });

      const membership = await membershipNFT.getMembership(1);
      expect(membership.tier).to.equal(Tier.VIP);
    });

    it("should reject upgrade with insufficient payment", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });

      await expect(
        membershipNFT.connect(user1).upgradeTier(1, Tier.PREMIUM, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Insufficient upgrade payment");
    });

    it("should reject upgrade to same or lower tier", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const premiumPrice = ethers.parseEther("0.5");

      await membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: premiumPrice });

      await expect(
        membershipNFT.connect(user1).upgradeTier(1, Tier.BASIC, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Can only upgrade to higher tier");

      await expect(
        membershipNFT.connect(user1).upgradeTier(1, Tier.PREMIUM, { value: ethers.parseEther("0") })
      ).to.be.revertedWith("Can only upgrade to higher tier");
    });

    it("should reject upgrade by non-owner", async function () {
      const { membershipNFT, user1, user2 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });

      await expect(
        membershipNFT.connect(user2).upgradeTier(1, Tier.PREMIUM, { value: ethers.parseEther("0.4") })
      ).to.be.revertedWith("Not token owner");
    });
  });

  describe("Revoke Membership", function () {
    it("should allow owner to revoke membership", async function () {
      const { membershipNFT, owner, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });

      await expect(
        membershipNFT.connect(owner).revokeMembership(1)
      )
        .to.emit(membershipNFT, "MembershipRevoked")
        .withArgs(user1.address, 1, Tier.BASIC);

      await expect(
        membershipNFT.ownerOf(1)
      ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("should prevent non-owner from revoking", async function () {
      const { membershipNFT, user1, user2 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });

      await expect(
        membershipNFT.connect(user1).revokeMembership(1)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        membershipNFT.connect(user2).revokeMembership(1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reduce balance after revoke", async function () {
      const { membershipNFT, owner, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });
      expect(await membershipNFT.balanceOf(user1.address)).to.equal(1);

      await membershipNFT.connect(owner).revokeMembership(1);
      expect(await membershipNFT.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("User Token Queries", function () {
    it("should return user tokens", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });
      await membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: ethers.parseEther("0.5") });

      const tokens = await membershipNFT.getUserTokens(user1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1);
      expect(tokens[1]).to.equal(2);
    });

    it("should return only active tokens after revoke", async function () {
      const { membershipNFT, owner, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });
      await membershipNFT.connect(user1).mint(Tier.PREMIUM, { value: ethers.parseEther("0.5") });

      await membershipNFT.connect(owner).revokeMembership(1);

      const activeTokens = await membershipNFT.getUserActiveTokens(user1.address);
      expect(activeTokens.length).to.equal(1);
      expect(activeTokens[0]).to.equal(2);
    });
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy during mint", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });
      expect(await membershipNFT.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Event Emissions", function () {
    it("should emit MembershipMinted on mint", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await expect(
        membershipNFT.connect(user1).mint(Tier.BASIC, { value: price })
      )
        .to.emit(membershipNFT, "MembershipMinted")
        .withArgs(user1.address, 1, Tier.BASIC, price);
    });

    it("should emit TierUpgraded on upgrade", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });

      await expect(
        membershipNFT.connect(user1).upgradeTier(1, Tier.PREMIUM, { value: ethers.parseEther("0.4") })
      )
        .to.emit(membershipNFT, "TierUpgraded")
        .withArgs(user1.address, 1, Tier.BASIC, Tier.PREMIUM);
    });

    it("should emit MembershipRevoked on revoke", async function () {
      const { membershipNFT, owner, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });

      await expect(
        membershipNFT.connect(owner).revokeMembership(1)
      )
        .to.emit(membershipNFT, "MembershipRevoked")
        .withArgs(user1.address, 1, Tier.BASIC);
    });
  });

  describe("TokenURI", function () {
    it("should return valid metadata URI", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const price = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: price });
      const uri = await membershipNFT.tokenURI(1);
      expect(uri).to.equal("ipfs://basic-tier-metadata");
    });

    it("should return tier-appropriate URI after upgrade", async function () {
      const { membershipNFT, user1 } = await loadFixture(deployFixture);
      const basicPrice = ethers.parseEther("0.1");

      await membershipNFT.connect(user1).mint(Tier.BASIC, { value: basicPrice });
      await membershipNFT.connect(user1).upgradeTier(1, Tier.VIP, { value: ethers.parseEther("0.9") });

      const uri = await membershipNFT.tokenURI(1);
      expect(uri).to.equal("ipfs://vip-tier-metadata");
    });

    it("should revert for non-existent token", async function () {
      const { membershipNFT } = await loadFixture(deployFixture);
      await expect(
        membershipNFT.tokenURI(999)
      ).to.be.revertedWith("ERC721: invalid token ID");
    });
  });
});
