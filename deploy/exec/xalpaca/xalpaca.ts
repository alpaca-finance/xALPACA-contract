import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { XALPACA, XALPACA__factory } from "../../../typechain";

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
  const ALPACA_TOKEN = ""; // Address of alpaca token

  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying xALPACA`);
  const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
  const xALPACA = (await upgrades.deployProxy(XALPACA, [ALPACA_TOKEN])) as XALPACA;
  await xALPACA.deployed();
  console.log(`>> Deployed at ${xALPACA.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["XAlpaca"];
