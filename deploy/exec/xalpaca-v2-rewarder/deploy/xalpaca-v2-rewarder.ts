import { ethers, upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const config = ConfigEntity.getConfig();
  /*
    ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
    ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
    ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
    ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
    ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
    ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
    Check all variables below before execute the deployment script
*/

  const NEW_REWARDER = {
    name: "USDT Rewarder",
    xALPACAv2RevenueDistributor: config.xALPACAv2RevenueDistributor!,
    rewardToken: "",
  };

  const deployer = await getDeployer();

  console.log(`>> Deploying xALPACAv2Rewarder`);
  const xALPACAv2RewarderFactory = (await ethers.getContractFactory(
    "xALPACAv2Rewarder",
    deployer
  )) as XALPACAv2Rewarder__factory;

  const xALPACAv2Rewarder = (await upgrades.deployProxy(xALPACAv2RewarderFactory, [
    NEW_REWARDER.name,
    NEW_REWARDER.xALPACAv2RevenueDistributor,
    NEW_REWARDER.rewardToken,
  ])) as XALPACAv2Rewarder;

  await xALPACAv2Rewarder.deployed();
  console.log(`>> Deployed at ${xALPACAv2Rewarder.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["DeployxALPACAv2Rewarder"];
