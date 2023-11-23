import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades, network } from "hardhat";
import { getConfig } from "../../../entities/config";
import { AlpacaFeeder__factory } from "../../../../typechain";
import { Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { fileService } from "../../../services";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const TITLE = "upgrade_alpaca_feeder";
  const EXACT_ETA = "1640923200";

  const deployer = await getDeployer();
  const config = getConfig();
  const timelock = Timelock__factory.connect(config.Timelock, deployer);

  console.log(`============`);
  console.log(`>> Upgrading Alpaca Feeder at ${config.ALPACAFeeder} through Timelock + ProxyAdmin`);
  console.log(">> Prepare upgrade & deploy if needed a new IMPL automatically.");
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder")) as AlpacaFeeder__factory;
  const preparedNewAlpacaFeeder = await upgrades.prepareUpgrade(config.ALPACAFeeder, AlpacaFeeder);
  console.log(`>> Implementation address: ${preparedNewAlpacaFeeder}`);
  console.log("✅ Done");

  console.log(`>> Queue tx on Timelock to upgrade the implementation`);
  const timelockTransactions = await timelock.queueTransaction(
    config.ProxyAdmin,
    "0",
    "upgrade(address,address)",
    ethers.utils.defaultAbiCoder.encode(["address", "address"], [config.ALPACAFeeder, preparedNewAlpacaFeeder]),
    EXACT_ETA
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
