import { XALPACA__factory } from "./../../../../typechain/factories/XALPACA__factory";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades, network } from "hardhat";
import { getConfig } from "../../../entities/config";
import { fileService, TimelockService } from "../../../services";
import { getDeployer, isFork } from "../../../../utils/deployer-helper";
import { compare } from "../../../../utils/address";
import { ProxyAdmin__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { TimelockEntity } from "../../../entities";

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
  const TITLE = "upgrade_xalpaca";
  const NAME = "xALPACA";
  const EXACT_ETA = "1653004800";

  const config = getConfig();
  const TARGET_XALPACA_ADDRESS = config.xALPACA;

  const deployer = await getDeployer();
  console.log("> XALPACA ", TARGET_XALPACA_ADDRESS);
  console.log("> DEPLOYER ", deployer.address);
  console.log("> PROXY ADMIN ", config.ProxyAdmin);

  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  const proxyAdminOwner = await (await ProxyAdmin__factory.connect(config.ProxyAdmin, deployer)).owner();
  const isTimelockOwner = compare(proxyAdminOwner, config.Timelock);
  const newXALPACA = (await ethers.getContractFactory(NAME)) as XALPACA__factory;
  let nonce = await deployer.getTransactionCount();
  const preparedNewXALPACA = await upgrades.prepareUpgrade(TARGET_XALPACA_ADDRESS, newXALPACA);
  const ops = isFork(network.name) ? { nonce: nonce++ } : { nonce: nonce++, gasLimit: 20000000 };

  if (isTimelockOwner) {
    console.log(`> Upgrading XALPACA at ${TARGET_XALPACA_ADDRESS} through Timelock + ProxyAdmin`);
    console.log("> Prepare upgrade & deploy if needed a new IMPL automatically.");
    console.log(`> Implementation address: ${preparedNewXALPACA}`);

    timelockTransactions.push(
      await TimelockService.queueTransaction(
        `> Queue tx to upgrade ${TARGET_XALPACA_ADDRESS}`,
        config.ProxyAdmin,
        "0",
        "upgrade(address,address)",
        ["address", "address"],
        [TARGET_XALPACA_ADDRESS, preparedNewXALPACA],
        EXACT_ETA,
        ops
      )
    );
  } else {
    console.log("> Executing without Timelock");
    console.log(`> Implementation address: ${preparedNewXALPACA}`);
    const proxyAdmin = ProxyAdmin__factory.connect(config.ProxyAdmin, deployer);
    await proxyAdmin.upgrade(TARGET_XALPACA_ADDRESS, preparedNewXALPACA, ops);

    console.log("✅ Done");
  }

  if (isTimelockOwner) {
    const timestamp = Math.floor(Date.now() / 1000);
    const fileName = `${timestamp}_${TITLE}`;
    console.log(`> Writing File ${fileName}`);
    fileService.writeJson(fileName, timelockTransactions);
    console.log("✅ Done");
  }
};

export default func;
func.tags = ["UpgradeXALPACA"];
