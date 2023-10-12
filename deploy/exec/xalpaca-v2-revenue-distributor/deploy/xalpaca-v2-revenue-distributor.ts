import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { XALPACAv2RevenueDistributor, XALPACAv2RevenueDistributor__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
    ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
    ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
    ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
    ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
    ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
    Check all variables below before execute the deployment script
*/
  const config = ConfigEntity.getConfig();
  const deployer = await getDeployer();

  console.log(`>> Deploying xALPACAv2RevenueDistributor`);
  const xALPACAv2RevenueDistributor = (await ethers.getContractFactory(
    "xALPACAv2RevenueDistributor",
    deployer
  )) as XALPACAv2RevenueDistributor__factory;
  const xAlpacaV2RevenueDistributor = (await upgrades.deployProxy(xALPACAv2RevenueDistributor, [
    config.Tokens.ALPACA,
  ])) as XALPACAv2RevenueDistributor;

  await xAlpacaV2RevenueDistributor.deployed();
  console.log(`>> Deployed at ${xAlpacaV2RevenueDistributor.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["DeployxALPACAv2RevenueDistributor"];
