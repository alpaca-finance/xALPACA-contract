import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IGrassHouse {
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
  const GRASSHOUSES: Array<IGrassHouse> = [{ NAME: "" }, { NAME: "" }];

  const config = ConfigEntity.getConfig();

  const deployer = (await ethers.getSigners())[0];

  for (const grassHouseConfig of GRASSHOUSES) {
    const grasshouse = config.GrassHouses.find((gh) => {
      gh.name === grassHouseConfig.NAME;
    });
    if (!grasshouse) {
      console.log(`>> ${grassHouseConfig.NAME} GrassHouse not found`);
      continue;
    }
    console.log(`>> Checking point GrassHouse ${grasshouse.name}`);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouse.address, deployer);
    await grassHouseAsDeployer.checkpointToken();
    console.log(`✅ Done checkpoint for ${grasshouse.name} at ${grasshouse.address}`);
  }
};

export default func;
func.tags = ["GrassHouseCheckpoint"];
