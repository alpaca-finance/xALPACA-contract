import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IGrassHouse {
    SYMBOL: string;
    TOKEN_ADDRESS: string;
    START_TIME: string;
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
    { SYMBOL: "ALPACA", TOKEN_ADDRESS: "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F", START_TIME: "1639612800" },
    { SYMBOL: "THG", TOKEN_ADDRESS: "0x9fd87aefe02441b123c3c32466cd9db4c578618f", START_TIME: "1639612800" },
    { SYMBOL: "PAYB", TOKEN_ADDRESS: "0x916792fd41855914ba4b71285c8a05b866f0618b", START_TIME: "1640217600" },
  ];

  const config = ConfigEntity.getConfig();
  const deployer = (await ethers.getSigners())[0];

  for (const grassHouseConfig of GRASSHOUSES) {
    console.log(`>> Deploying GrassHouse ${grassHouseConfig.SYMBOL}`);
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    const grassHouse = (await upgrades.deployProxy(GrassHouse, [
      config.xALPACA,
      grassHouseConfig.START_TIME,
      grassHouseConfig.TOKEN_ADDRESS,
      await deployer.getAddress(),
    ])) as GrassHouse;
    await grassHouse.deployed();
    console.log(`>> Deployed at ${grassHouse.address}`);
    console.log("✅ Done");
  }
};

export default func;
func.tags = ["GrassHouse"];
