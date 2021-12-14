import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { BEP20__factory, GrassHouse, GrassHouse__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IGrassHouse {
    NAME: string;
    AMOUNT: string;
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
    { NAME: "", AMOUNT: "" },
    { NAME: "", AMOUNT: "" },
  ];

  const deployer = (await ethers.getSigners())[0];
  const config = ConfigEntity.getConfig();

  for (const grassHouseConfig of GRASSHOUSES) {
    const grasshouse = config.GrassHouses.find((gh) => {
      gh.name === grassHouseConfig.NAME;
    });
    if (!grasshouse) {
      console.log(`>> ${grassHouseConfig.NAME} GrassHouse not found`);
      continue;
    }
    console.log(
      `>> Feeding ${grassHouseConfig.AMOUNT} ${grasshouse.name} to GrassHouse ${grasshouse.name} at ${grasshouse.address}`
    );
    const grassHouseTokenAsDeployer = BEP20__factory.connect(grasshouse.rewardToken, deployer);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouse.address, deployer);

    await grassHouseTokenAsDeployer.approve(grasshouse.address, ethers.utils.parseEther(grassHouseConfig.AMOUNT));
    await grassHouseAsDeployer.feed(ethers.utils.parseEther(grassHouseConfig.AMOUNT));
    console.log(
      `✅ Done Feed ${grassHouseConfig.AMOUNT} ${grasshouse.name} to GrassHouse ${grasshouse.name} at ${grasshouse.address}`
    );
  }
};
