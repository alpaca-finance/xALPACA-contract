import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { ProxyToken, ProxyToken__factory } from "../../../../typechain";
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

  const config = ConfigEntity.getConfig();
  const deployer = await getDeployer();

  console.log(`>> Deploying fdALPACA`);
  const ProxyToken = (await ethers.getContractFactory("ProxyToken", deployer)) as ProxyToken__factory;
  const proxyToken = (await upgrades.deployProxy(ProxyToken, [`fdALPACA`, `fdALPACA`, config.Timelock])) as ProxyToken;
  await proxyToken.deployed();
  console.log(`>> Deployed at ${proxyToken.address}`);
  console.log("✅ Done");
};

export default func;
func.tags = ["ProxyToken"];
