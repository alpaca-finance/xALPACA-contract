import { ProxyAdmin__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { ethers, upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployer, isFork } from "../../../../utils/deployer-helper";
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
  const config = getConfig();

  const TITLE = "upgrade_xalpacav2_revenue_distributor";
  const VERSION = "xALPACAv2RevenueDistributor";
  const EXACT_ETA = "1712314800";
  const REWARDER_NAME = "PYTH";
  let nonce = 0;
  let rewarder_config = config.xALPACAv2Rewarders.find((rewarder) => rewarder.name === REWARDER_NAME);

  if (!rewarder_config) {
    console.log(`Rewarder ${REWARDER_NAME} not found`);
    return;
  }

  const TARGET_XALPACAv2REVENUEDISTRIBUTOR_ADDRESS = config.xALPACAv2RevenueDistributor!;

  const deployer = await getDeployer();

  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  const proxyAdminOwner = await ProxyAdmin__factory.connect(config.ProxyAdmin, deployer).owner();
  const newImpl = await ethers.getContractFactory(VERSION);

  const preparedNewXALPACAv2 = await upgrades.prepareUpgrade(rewarder_config.address, newImpl);
  const networkInfo = await ethers.provider.getNetwork();

  console.log(`> Upgrading XALPACA at ${rewarder_config.address} through Timelock + ProxyAdmin`);
  console.log("> Prepare upgrade & deploy if needed a new IMPL automatically.");
  console.log(`> Implementation address: ${preparedNewXALPACAv2}`);

  const timelock = new MaybeMultisigTimelock(networkInfo.chainId, deployer);

  timelockTransactions.push(
    await timelock.queueTransaction(
      `> Queue tx to upgrade ${rewarder_config?.address}`,
      config.ProxyAdmin,
      "0",
      "upgrade(address,address)",
      ["address", "address"],
      [rewarder_config?.address, preparedNewXALPACAv2],
      EXACT_ETA,
      { nonce: nonce++ }
    )
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const fileName = `${timestamp}_${TITLE}`;
  console.log(`> Writing File ${fileName}`);
  fileService.writeJson(fileName, timelockTransactions);
  console.log("✅ Done");
};

export default func;
func.tags = ["UpgradeXALPACAv2Rewarder"];
