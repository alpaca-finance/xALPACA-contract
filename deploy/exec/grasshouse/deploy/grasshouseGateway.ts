import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouseGateway__factory, GrassHouse__factory } from "../../../../typechain";

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

  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying GrassHouseGateway`);
  const grassHouseGateWayAsDeployer = (await ethers.getContractFactory(
    "GrassHouseGateway",
    deployer
  )) as GrassHouseGateway__factory;
  const grassHouseGateWay = await grassHouseGateWayAsDeployer.deploy();

  console.log(`✅ Done deploy GrassHouseGateWay at : ${grassHouseGateWay.address}`);
};

export default func;
func.tags = ["GrassHouseGateway"];
