import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades, network } from "hardhat";
import { getConfig } from "../../../entities/config";
import { GrassHouse__factory } from "../../../../typechain";
import { Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { MaybeMultisigTimelock } from "../../../services/timelock/maybe-multisig";

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
  const EXACT_ETA = "1679295600";

  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  const config = getConfig();
  const timelock = new MaybeMultisigTimelock(networkInfo.chainId, deployer);

  for (const grasshouse of config.GrassHouses) {
    if (grasshouse.name !== "ALPACA") continue;
    console.log(`============`);
    console.log(`> Upgrading grasshouse at ${grasshouse.address} through Timelock + ProxyAdmin`);
    const GrassHouse = (await ethers.getContractFactory("GrassHouse")) as GrassHouse__factory;
    const preparedNewGrassHouse = await upgrades.prepareUpgrade(grasshouse.address, GrassHouse);
    console.log(`> Implementation address: ${preparedNewGrassHouse}`);
    console.log("> ✅ Done");

    console.log(`> Queue tx on Timelock to upgrade the implementation`);
    await timelock.queueTransaction(
      `Upgrade ${grasshouse.name} GrassHouse`,
      config.ProxyAdmin,
      "0",
      "upgrade(address,address)",
      ["address", "address"],
      [grasshouse.address, preparedNewGrassHouse],
      EXACT_ETA
    );
    console.log("> ✅ Done");
  }
};

export default func;
func.tags = ["UpgradeGrassHouse"];
