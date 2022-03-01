import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { RootStorage__factory, RootStorage } from "./../../../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IRootStorage {
    NAME: string;
  }
  /*
      ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
      ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
      ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
      ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
      ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
      ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
      Check all variables below before execute the deployment script
  */

  const RootStorageConfig: IRootStorage = {
    NAME: "",
  };

  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying RootStorage ${RootStorageConfig.NAME}`);

  const RootStorage = (await ethers.getContractFactory("RootStorage", deployer)) as RootStorage__factory;
  const rootstorage = (await upgrades.deployProxy(RootStorage, [RootStorageConfig.NAME])) as RootStorage;
  await rootstorage.deployed();

  const deployTx = await rootstorage.deployTransaction.wait(3);
  console.log(`>> Deployed at ${rootstorage.address}`);
  console.log(`>> Deployed at: `, deployTx.blockNumber);
  console.log("✅ Done");
};

export default func;
func.tags = ["RootStorage"];
