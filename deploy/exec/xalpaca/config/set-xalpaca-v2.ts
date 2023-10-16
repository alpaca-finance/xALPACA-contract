import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { XALPACAMigrator__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { getConfig } from "../../../entities/config";

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
  const xALPACAv2 = "";

  const config = getConfig();
  const deployer = await getDeployer();

  const xAlpacaMigrator = XALPACAMigrator__factory.connect(config.xALPACA, deployer);

  const setxAlpacaV2Tx = await xAlpacaMigrator.setxALPACAv2(xALPACAv2);
  console.log(`✅ Done at: ${setxAlpacaV2Tx.hash}`);
};
export default func;
func.tags = ["SetxALPACAv2"];
