import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades, network } from "hardhat";
import { getConfig } from "../../../entities/config";
import { AlpacaFeeder__factory } from "../../../../typechain";
import { getDeployer, isFork } from "../../../../utils/deployer-helper";
import { fileService } from "../../../services";
import { MaybeMultisigTimelock } from "../../../services/timelock/maybe-multisig";
import { TimelockEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const TITLE = "upgrade_alpaca_feeder";
  const EXACT_ETA = "1700820000";

  const deployer = await getDeployer();
  const config = getConfig();

  console.log(`============`);
  console.log(`>> Upgrading Alpaca Feeder at ${config.ALPACAFeeder} through Timelock + ProxyAdmin`);
  console.log(">> Prepare upgrade & deploy if needed a new IMPL automatically.");
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder")) as AlpacaFeeder__factory;
  const preparedNewAlpacaFeeder = await upgrades.prepareUpgrade(config.ALPACAFeeder, AlpacaFeeder);
  console.log(`>> Implementation address: ${preparedNewAlpacaFeeder}`);
  console.log("✅ Done");

  const networkInfo = await ethers.provider.getNetwork();
  const ops = isFork() ? { gasLimit: 20000000 } : {};
  const timelock = new MaybeMultisigTimelock(networkInfo.chainId, deployer);
  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  console.log(`>> Queue tx on Timelock to upgrade the implementation`);
  timelockTransactions.push(
    await timelock.queueTransaction(
      `> Queue tx to upgrade ${config.ALPACAFeeder}`,
      config.ProxyAdmin,
      "0",
      "upgrade(address,address)",
      ["address", "address"],
      [config.ALPACAFeeder, preparedNewAlpacaFeeder],
      EXACT_ETA,
      ops
    )
  );
  console.log("✅ Done");

  const timestamp = Math.floor(Date.now() / 1000);
  const fileName = `${timestamp}_${TITLE}`;
  console.log(`> Writing File ${fileName}`);
  fileService.writeJson(fileName, timelockTransactions);

  console.log("✅ Done");
};

export default func;
func.tags = ["UpgradeAlpacaFeeder"];
