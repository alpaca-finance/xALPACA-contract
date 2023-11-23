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
  const TITLE = "upgrade_xalpacav2";
  const xALPACAv2_VERSION = "xALPACAv2";
  const EXACT_ETA = "1700820000";

  const config = getConfig();
  const TARGET_XALPACAv2_ADDRESS = config.xALPACAv2!;

  const deployer = await getDeployer();

  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  const proxyAdminOwner = await ProxyAdmin__factory.connect(config.ProxyAdmin, deployer).owner();
  const newImpl = await ethers.getContractFactory(xALPACAv2_VERSION);
  let nonce = await deployer.getTransactionCount();
  const preparedNewXALPACAv2 = await upgrades.prepareUpgrade(TARGET_XALPACAv2_ADDRESS, newImpl);
  const networkInfo = await ethers.provider.getNetwork();
  const ops = isFork() ? { nonce: nonce++, gasLimit: 20000000 } : { nonce: nonce++ };

  console.log(`> Upgrading XALPACA at ${TARGET_XALPACAv2_ADDRESS} through Timelock + ProxyAdmin`);
  console.log("> Prepare upgrade & deploy if needed a new IMPL automatically.");
  console.log(`> Implementation address: ${preparedNewXALPACAv2}`);

  const timelock = new MaybeMultisigTimelock(networkInfo.chainId, deployer);

  timelockTransactions.push(
    await timelock.queueTransaction(
      `> Queue tx to upgrade ${TARGET_XALPACAv2_ADDRESS}`,
      config.ProxyAdmin,
      "0",
      "upgrade(address,address)",
      ["address", "address"],
      [TARGET_XALPACAv2_ADDRESS, preparedNewXALPACAv2],
      EXACT_ETA,
      ops
    )
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const fileName = `${timestamp}_${TITLE}`;
  console.log(`> Writing File ${fileName}`);
  fileService.writeJson(fileName, timelockTransactions);
  console.log("✅ Done");
};

export default func;
func.tags = ["UpgradeXALPACAv2"];
