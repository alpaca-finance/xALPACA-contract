import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { ScientixFeeder, ScientixFeeder__factory, ProxyToken, ProxyToken__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";

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
  // const POOL_ID = "8";
  // const config = ConfigEntity.getConfig();
  // const deployer = (await ethers.getSigners())[0];
  // let nonce = await deployer.getTransactionCount();
  // const scientixGrassHouseAddress = config.GrassHouses.find((gh) => gh.name === "SCIX");
  // if (scientixGrassHouseAddress === undefined) throw new Error(`could not find Scientix GrassHouse`);
  // console.log(`>> Deploying ScientixFeeder`);
  // const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
  // const scientixFeeder = (await upgrades.deployProxy(ScientixFeeder, [
  //   config.Tokens.SCIX,
  //   config.Tokens.fdSCIX,
  //   config.ScientixStakingPool.address,
  //   POOL_ID,
  //   scientixGrassHouseAddress.address,
  // ])) as ScientixFeeder;
  // await scientixFeeder.deployed();
  // nonce++;
  // console.log(`>> Deployed at ${scientixFeeder.address}`);
  // console.log("✅ Done");
  // console.log(">> Transferring ownership and set okHolders of proxyToken to be scientixFeeder");
  // const proxyToken = ProxyToken__factory.connect(config.Tokens.fdSCIX, deployer);
  // await proxyToken.setOkHolders([scientixFeeder.address, config.ScientixStakingPool.address], true, { nonce: nonce++ });
  // await proxyToken.transferOwnership(scientixFeeder.address, { nonce: nonce++ });
  // console.log("✅ Done");
  // console.log(">> Sleep for 10000msec waiting for scientixFeeder to completely deployed");
  // await new Promise((resolve) => setTimeout(resolve, 10000));
  // console.log("✅ Done");
  // console.log(">> Depositing proxyToken to Fairlaunch pool");
  // await scientixFeeder.stakingPoolDeposit({ nonce });
  // console.log("✅ Done");
};

export default func;
func.tags = ["ScientixFeeder"];
