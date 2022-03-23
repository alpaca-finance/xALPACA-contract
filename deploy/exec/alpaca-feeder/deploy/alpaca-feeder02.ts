import { AlpacaFeeder02__factory } from "./../../../../typechain/factories/AlpacaFeeder02__factory";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import {
  AlpacaFeeder,
  AlpacaFeeder02,
  AlpacaFeeder__factory,
  ProxyToken,
  ProxyToken__factory,
} from "../../../../typechain";
import { FairLaunch__factory, Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";

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
  const POOL_ID = "";

  const config = ConfigEntity.getConfig();
  const deployer = await getDeployer();
  let nonce = await deployer.getTransactionCount();

  const alpacaGrassHouseAddress = config.GrassHouses.find((gh) => gh.name === "ALPACA");
  if (alpacaGrassHouseAddress === undefined) throw new Error(`could not find ALPACA GrassHouse`);
  if (config.Tokens.fdALPACA === undefined) throw new Error(`could not find config.Tokens.fdALPACA`);
  if (config.MiniFL === undefined) throw new Error(`could not find config.MiniFL`);

  console.log(`>> Deploying AlpacaFeeder02`);
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder02", deployer)) as AlpacaFeeder02__factory;
  const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
    config.Tokens.ALPACA,
    config.Tokens.fdALPACA,
    config.MiniFL.address,
    POOL_ID,
    alpacaGrassHouseAddress.address,
  ])) as AlpacaFeeder02;
  await alpacaFeeder.deployed();
  nonce++;
  console.log(`>> Deployed alpacafeeder02 at ${alpacaFeeder.address}`);
  console.log("✅ Done");

  console.log(">> Transferring ownership and set okHolders of proxyToken to be alpacaFeeder");
  const proxyToken = ProxyToken__factory.connect(config.Tokens.fdALPACA, deployer);
  await proxyToken.setOkHolders([alpacaFeeder.address, config.MiniFL.address], true, { nonce: nonce++ });
  await proxyToken.transferOwnership(alpacaFeeder.address, { nonce: nonce++ });
  console.log("✅ Done");

  console.log(">> Sleep for 10000msec waiting for alpacaFeeder to completely deployed");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log("✅ Done");

  console.log(">> Depositing proxyToken to MiniFL pool");
  await alpacaFeeder.miniFLDeposit({ nonce });
  console.log("✅ Done");
};

export default func;
func.tags = ["AlpacaFeeder02"];
