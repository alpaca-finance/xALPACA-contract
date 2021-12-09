import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { BEP20__factory, GrassHouse, GrassHouse__factory } from "../../../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IGrassHouse {
    SYMBOL: string;
    GRASSHOUSE_ADDRESS: string;
    TOKEN_ADDRESS: string;
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
    { SYMBOL: "", GRASSHOUSE_ADDRESS: "", TOKEN_ADDRESS: "", AMOUNT: "" },
    { SYMBOL: "", GRASSHOUSE_ADDRESS: "", TOKEN_ADDRESS: "", AMOUNT: "" },
  ];

  const deployer = (await ethers.getSigners())[0];

  for (const grassHouseConfig of GRASSHOUSES) {
    console.log(
      `>> Feeding ${grassHouseConfig.AMOUNT} ${grassHouseConfig.SYMBOL} to GrassHouse ${grassHouseConfig.SYMBOL} at ${grassHouseConfig.GRASSHOUSE_ADDRESS}`
    );
    const grassHouseTokenAsDeployer = BEP20__factory.connect(grassHouseConfig.TOKEN_ADDRESS, deployer);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grassHouseConfig.GRASSHOUSE_ADDRESS, deployer);

    await grassHouseTokenAsDeployer.approve(
      grassHouseConfig.GRASSHOUSE_ADDRESS,
      ethers.utils.parseEther(grassHouseConfig.AMOUNT)
    );
    await grassHouseAsDeployer.feed(ethers.utils.parseEther(grassHouseConfig.AMOUNT));
    console.log(
      `✅ Done Feed ${grassHouseConfig.AMOUNT} ${grassHouseConfig.SYMBOL} to GrassHouse ${grassHouseConfig.SYMBOL} at ${grassHouseConfig.GRASSHOUSE_ADDRESS}`
    );
  }
};
