import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { ProxyToken, ProxyToken__factory } from "../../../typechain";
import { Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";

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
  const SYMBOL = "ProxyToken";
  const TIMELOCK = "0x2D5408f2287BF9F9B05404794459a846651D0a59";

  const deployer = (await ethers.getSigners())[0];

  console.log(`>> Deploying ${SYMBOL}`);
  const ProxyToken = (await ethers.getContractFactory(SYMBOL, deployer)) as ProxyToken__factory;
  const proxyToken = (await upgrades.deployProxy(ProxyToken, [`proxyToken`, `proxyToken`, TIMELOCK])) as ProxyToken;
  await proxyToken.deployed();
  console.log(`>> Deployed at ${proxyToken.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["ProxyToken"];
