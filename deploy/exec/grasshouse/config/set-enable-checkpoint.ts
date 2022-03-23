import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";

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
  const deployer = await getDeployer();
  const config = ConfigEntity.getConfig();

  for (const grassHouseConfig of GRASSHOUSES) {
    const grasshouse = config.GrassHouses.find((gh) => {
      gh.name === grassHouseConfig.NAME;
    });
    if (!grasshouse) {
      console.log(`>> ${grassHouseConfig.NAME} GrassHouse not found`);
      continue;
    }
    console.log(`>> Enabling checkpoint GrassHouse ${grasshouse.name}`);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouse.address, deployer);
    await grassHouseAsDeployer.setCanCheckpointToken(true);
    console.log(`✅ Done enabling checkpoint for ${grasshouse.name} at ${grasshouse.address}`);
  }
};

export default func;
func.tags = ["GrassHouseEnableCheckpoint"];
