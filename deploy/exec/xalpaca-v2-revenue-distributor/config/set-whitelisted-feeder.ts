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

  const WHITELISTED_FEEDERS = ["0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51"];
  const IS_OK_CALLER = true;

  const deployer = await getDeployer();

  const xALPACAv2RevenueDistributor = XALPACAv2RevenueDistributor__factory.connect(
    config.xALPACAv2RevenueDistributor!,
    deployer
  );

  const setWhitelistedFeederTx = await xALPACAv2RevenueDistributor.setWhitelistedFeeders(
    WHITELISTED_FEEDERS,
    IS_OK_CALLER
  );

  console.log(`✅ Done at: ${setWhitelistedFeederTx.hash}`);
};
export default func;
func.tags = ["SetWhitelistedFeedersxALPACAv2RevenueDistributor"];
