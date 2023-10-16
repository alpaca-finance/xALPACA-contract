import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { XALPACAv2RevenueDistributor__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { getConfig } from "../../../entities/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const config = getConfig();
  /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */

  const WHITELISTED_CALLERS = [config.xALPACAv2!];
  const IS_OK_CALLER = true;

  const deployer = await getDeployer();

  const xALPACAv2RevenueDistributor = XALPACAv2RevenueDistributor__factory.connect(
    config.xALPACAv2RevenueDistributor!,
    deployer
  );

  const setWhitelistedCallerTx = await xALPACAv2RevenueDistributor.setWhitelistedCallers(
    WHITELISTED_CALLERS,
    IS_OK_CALLER
  );

  console.log(`✅ Done at: ${setWhitelistedCallerTx.hash}`);
};
export default func;
func.tags = ["SetWhitelistedCallersxALPACAv2RevenueDistributor"];
