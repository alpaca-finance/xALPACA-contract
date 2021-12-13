import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { AlpacaFeeder, AlpacaFeeder__factory, ProxyToken, ProxyToken__factory } from "../../../../typechain";
import { FairLaunch__factory, Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { ConfigEntity } from "../../../entities";

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
  const PROXY_TOKEN = "";
  const POOL_ID = "";
  const ALPACA_GRASSHOUSE = "";

  const config = ConfigEntity.getConfig();
  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying AlpacaFeeder`);
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
  const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
    config.Tokens.ALPACA,
    PROXY_TOKEN,
    config.FairLaunch.address,
    POOL_ID,
    ALPACA_GRASSHOUSE,
  ])) as AlpacaFeeder;
  await alpacaFeeder.deployed();
  console.log(`>> Deployed at ${alpacaFeeder.address}`);
  console.log("✅ Done");

  console.log(">> Transferring ownership and set okHolders of proxyToken to be alpacaFeeder");
  const proxyToken = ProxyToken__factory.connect(PROXY_TOKEN, deployer);
  await proxyToken.setOkHolders([alpacaFeeder.address, config.FairLaunch.address], true);
  await proxyToken.transferOwnership(alpacaFeeder.address);
  console.log("✅ Done");

  console.log(">> Depositing proxyToken to Fairlaunch pool");
  await alpacaFeeder.fairLaunchDeposit();
  console.log("✅ Done");
};

export default func;
func.tags = ["AlpacaFeeder"];