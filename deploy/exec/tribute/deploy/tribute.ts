import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { Tribute__factory, Tribute } from "./../../../../typechain";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface ITribute {
    ROORT_STORAGE_ADDRESS: string;
    REWARD_TOKEN_ADDRESS: string;
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
  const config = ConfigEntity.getConfig();

  const KEEPER_WHITELIST: string[] = [""];
  const TRIBUTES: Array<ITribute> = [
    {
      ROORT_STORAGE_ADDRESS: "",
      REWARD_TOKEN_ADDRESS: "",
    },
  ];

  const deployer = (await ethers.getSigners())[0];

  for (const tributeConfig of TRIBUTES) {
    console.log(`>> Deploying Tribute Reward token ${tributeConfig.REWARD_TOKEN_ADDRESS}`);

    const Tribute = (await ethers.getContractFactory("Tribute", deployer)) as Tribute__factory;
    const tribute = (await upgrades.deployProxy(Tribute, [
      tributeConfig.ROORT_STORAGE_ADDRESS,
      tributeConfig.REWARD_TOKEN_ADDRESS,
    ])) as Tribute;
    await tribute.deployed();

    const deployTx = await tribute.deployTransaction.wait(3);
    console.log(`>> Deployed at ${tribute.address}`);
    console.log(`>> Deployed at: `, deployTx.blockNumber);
    console.log("✅ Done");

    console.log(">> Whitelist keeper");
    const whitelistTx = await tribute.setKeepersOk(KEEPER_WHITELIST, true);
    await whitelistTx.wait(3);
    console.log("✅ Done");
  }
};

export default func;
func.tags = ["Tribute"];
