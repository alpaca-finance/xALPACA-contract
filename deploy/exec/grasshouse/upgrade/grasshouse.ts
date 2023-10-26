import { ethers, upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployer } from "../../../../utils/deployer-helper";
import { TimelockEntity } from "../../../entities";
import { getConfig } from "../../../entities/config";
import { fileService } from "../../../services";
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

  const TITLE = "upgrade_Grasshouse_to_Grasshouse_DisabledFeed";
  const GRASSHOUSE_VERSION = "GrassHouse_DisabledFeed";
  const TARGET_GRASSHOUSE = ["ALPACA"];
  const EXACT_ETA = "1698382800";

  const deployer = await getDeployer();
  const networkInfo = await ethers.provider.getNetwork();
  const config = getConfig();
  const timelock = new MaybeMultisigTimelock(networkInfo.chainId, deployer);
  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  const toBeUpgradedGrasshouses = config.GrassHouses.filter((gh) => TARGET_GRASSHOUSE.includes(gh.name));

  for (const grasshouse of toBeUpgradedGrasshouses) {
    console.log(`============`);
    console.log(`> Upgrading grasshouse at ${grasshouse.address} through Timelock + ProxyAdmin`);
    const GrassHouse = await ethers.getContractFactory(GRASSHOUSE_VERSION);
    const preparedNewGrassHouse = await upgrades.prepareUpgrade(grasshouse.address, GrassHouse);
    console.log(`> Implementation address: ${preparedNewGrassHouse}`);
    console.log("> ✅ Done");

    console.log(`> Queue tx on Timelock to upgrade the implementation`);
    timelockTransactions.push(
      await timelock.queueTransaction(
        `Upgrade ${grasshouse.name} GrassHouse`,
        config.ProxyAdmin,
        "0",
        "upgrade(address,address)",
        ["address", "address"],
        [grasshouse.address, preparedNewGrassHouse],
        EXACT_ETA,
        {}
      )
    );
    console.log("> ✅ Done");
  }

  if (timelockTransactions.length > 0) {
    const timestamp = Math.floor(new Date().getTime() / 1000);
    fileService.writeJson(`${timestamp}_${TITLE}`, timelockTransactions);
  }
};

export default func;
func.tags = ["UpgradeGrassHouse"];
