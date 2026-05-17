import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  verifyContracts: boolean;
  logDeployment: boolean;
  deploymentLogPath: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Network:", network.name, "(chainId:", network.config.chainId, ")");

  const config: DeploymentConfig = {
    verifyContracts: process.env.VERIFY_CONTRACTS === "true" && network.name !== "hardhat",
    logDeployment: true,
    deploymentLogPath: path.join(__dirname, "../deployments.json"),
  };

  const deploymentInfo: Record<string, string> = {};

  // Deploy MembershipNFT
  console.log("\nDeploying MembershipNFT...");
  const MembershipNFT = await ethers.getContractFactory("MembershipNFT");
  const membershipNFT = await MembershipNFT.deploy();
  await membershipNFT.waitForDeployment();
  const membershipNFTAddress = await membershipNFT.getAddress();
  deploymentInfo["MembershipNFT"] = membershipNFTAddress;
  console.log("MembershipNFT deployed to:", membershipNFTAddress);

  // Deploy AgeVerificationOracle
  console.log("\nDeploying AgeVerificationOracle...");
  const AgeVerificationOracle = await ethers.getContractFactory("AgeVerificationOracle");
  const oracle = await AgeVerificationOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  deploymentInfo["AgeVerificationOracle"] = oracleAddress;
  console.log("AgeVerificationOracle deployed to:", oracleAddress);

  // Deploy TokenGatedAccess
  console.log("\nDeploying TokenGatedAccess...");
  const TokenGatedAccess = await ethers.getContractFactory("TokenGatedAccess");
  const tokenGatedAccess = await TokenGatedAccess.deploy(membershipNFTAddress, oracleAddress);
  await tokenGatedAccess.waitForDeployment();
  const tokenGatedAccessAddress = await tokenGatedAccess.getAddress();
  deploymentInfo["TokenGatedAccess"] = tokenGatedAccessAddress;
  console.log("TokenGatedAccess deployed to:", tokenGatedAccessAddress);

  // Deploy ComplianceRegistry
  console.log("\nDeploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const complianceRegistry = await ComplianceRegistry.deploy();
  await complianceRegistry.waitForDeployment();
  const complianceRegistryAddress = await complianceRegistry.getAddress();
  deploymentInfo["ComplianceRegistry"] = complianceRegistryAddress;
  console.log("ComplianceRegistry deployed to:", complianceRegistryAddress);

  // Deploy SubscriptionManager
  console.log("\nDeploying SubscriptionManager...");
  const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
  const subscriptionManager = await SubscriptionManager.deploy();
  await subscriptionManager.waitForDeployment();
  const subscriptionManagerAddress = await subscriptionManager.getAddress();
  deploymentInfo["SubscriptionManager"] = subscriptionManagerAddress;
  console.log("SubscriptionManager deployed to:", subscriptionManagerAddress);

  // Log deployment info
  if (config.logDeployment) {
    const fullDeployment = {
      network: network.name,
      chainId: network.config.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deploymentInfo,
    };
    fs.writeFileSync(config.deploymentLogPath, JSON.stringify(fullDeployment, null, 2));
    console.log("\nDeployment info saved to:", config.deploymentLogPath);
  }

  // Verify contracts on Etherscan
  if (config.verifyContracts) {
    console.log("\nVerifying contracts on Etherscan...");
    for (const [name, address] of Object.entries(deploymentInfo)) {
      try {
        await run("verify:verify", {
          address,
          constructorArguments: [],
        });
        console.log(`${name} verified successfully`);
      } catch (error: any) {
        if (error.message?.includes("Already Verified")) {
          console.log(`${name} already verified`);
        } else {
          console.error(`Failed to verify ${name}:`, error.message);
        }
      }
    }
  }

  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
