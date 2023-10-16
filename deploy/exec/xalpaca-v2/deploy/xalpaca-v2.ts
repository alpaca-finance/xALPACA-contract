import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { XALPACAv2__factory, XALPACAv2 } from "../../../../typechain";
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

  const initializeInput = {
    token: config.Tokens.ALPACA,
    revenueDistributor: config.xALPACAv2RevenueDistributor!,
    delayUnlockTime: 1814400, // 21 days
    feeTreasury: "0x2bfdacF6CdBC3ECcb95E68ec448ECf3d0693F732",
    earlyWithdrawFeeBpsPerDay: 50, //0.5% per day
  };

  const deployer = await getDeployer();

  console.log(`>> Deploying xALPACAv2`);
  const XALPACAV2 = (await ethers.getContractFactory("xALPACAv2", deployer)) as XALPACAv2__factory;
  const xALPACAv2 = (await upgrades.deployProxy(XALPACAV2, [
    initializeInput.token,
    initializeInput.revenueDistributor,
    initializeInput.delayUnlockTime,
    initializeInput.feeTreasury,
    initializeInput.earlyWithdrawFeeBpsPerDay,
  ])) as XALPACAv2;
  await xALPACAv2.deployed();
  console.log(`>> Deployed at ${xALPACAv2.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["DeployxALPACAv2"];
