import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IGrassHouse {
    SYMBOL: string;
    GRASSHOUSE_ADDRESS: string;
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
  const GRASSHOUSES: Array<IGrassHouse> = [
    { SYMBOL: "", GRASSHOUSE_ADDRESS: "" },
    { SYMBOL: "", GRASSHOUSE_ADDRESS: "" },
  ];
  const deployer = (await ethers.getSigners())[0];

  for (const grassHouseConfig of GRASSHOUSES) {
    console.log(`>> Enabling checkpoint GrassHouse ${grassHouseConfig.SYMBOL}`);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grassHouseConfig.GRASSHOUSE_ADDRESS, deployer);
    await grassHouseAsDeployer.setCanCheckpointToken(true);
    console.log(`✅ Done enabling checkpoint for ${grassHouseConfig.SYMBOL} at ${grassHouseConfig.GRASSHOUSE_ADDRESS}`);
  }
};

export default func;
func.tags = ["GrassHouseEnableCheckpoint"];
