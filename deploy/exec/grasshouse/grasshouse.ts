import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../typechain";

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
  const SYMBOL = "";
  const TOKEN = "";
  const XALPACA = "";
  const START_TIME = "";

  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying GrassHouse ${SYMBOL}`);
  const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
  const grassHouse = (await upgrades.deployProxy(GrassHouse, [
    XALPACA,
    START_TIME,
    TOKEN,
    await deployer.getAddress(),
  ])) as GrassHouse;
  await grassHouse.deployed();
  console.log(`>> Deployed at ${grassHouse.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["GrassHouse"];
