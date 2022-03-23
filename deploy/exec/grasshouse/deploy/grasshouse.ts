import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { GrassHouse, GrassHouse__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";

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
    { SYMBOL: "HIGH", TOKEN_ADDRESS: "0x5f4bde007dc06b867f86ebfe4802e34a1ffeed63", START_TIME: "1642032000" },
    { SYMBOL: "DLTA", TOKEN_ADDRESS: "0x3a06212763CAF64bf101DaA4b0cEbb0cD393fA1a", START_TIME: "1642032000" },
  ];

  const config = ConfigEntity.getConfig();
  const deployer = await getDeployer();

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
