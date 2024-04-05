import { ethers, upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { ConfigEntity } from "../../../entities";

async function main() {
  const config = ConfigEntity.getConfig();
  /*
    ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
    ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
    ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
    ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
    ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
    ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
    Check all variables below before execute the deployment script
*/

  const deployer = await getDeployer();

  const REWARDER_ADDRESS = config.xALPACAv2Rewarders[0].address;

  const xALPACAv2RewarderFactory = new XALPACAv2Rewarder__factory(deployer);

  console.log(`> Upgrading xALPACAv2Rewarder at ${REWARDER_ADDRESS} through Timelock + ProxyAdmin`);
  console.log("> Prepare upgrade & deploy if needed a new IMPL automatically.");
  const preparedImpl = await upgrades.prepareUpgrade(REWARDER_ADDRESS, xALPACAv2RewarderFactory);
  console.log(`> Implementation address: ${preparedImpl.toString()}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
