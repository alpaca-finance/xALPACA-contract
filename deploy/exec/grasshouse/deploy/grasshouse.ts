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
  const CHECKPOINT_WHITELIST: string[] = ["0xe45216ac4816a5ec5378b1d13de8aa9f262ce9de"];
  const GRASSHOUSES: Array<IGrassHouse> = [
    { SYMBOL: "DEP", TOKEN_ADDRESS: "0xcaf5191fc480f43e4df80106c7695eca56e48b18", START_TIME: "1647475200" },
    { SYMBOL: "XWG", TOKEN_ADDRESS: "0x6b23c89196deb721e6fd9726e6c76e4810a464bc", START_TIME: "1647475200" },
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
    const deployTx = await grassHouse.deployTransaction.wait(3);
    console.log(`>> Deployed at ${grassHouse.address}`);
    console.log(`>> Deployed at: `, deployTx.blockNumber);
    console.log("✅ Done");

    console.log(">> Whitelist checkpoint token");
    const whitelistTx = await grassHouse.setWhitelistedCheckpointCallers(CHECKPOINT_WHITELIST, true);
    await whitelistTx.wait(3);
    console.log("✅ Done");
  }
};

export default func;
func.tags = ["GrassHouse"];
