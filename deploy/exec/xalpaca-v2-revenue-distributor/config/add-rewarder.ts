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

  const REWARDER = "0x2fF618769E1A3E721AdcFc61A841c549C1061461";

  const deployer = await getDeployer();

  const xALPACAv2RevenueDistributor = XALPACAv2RevenueDistributor__factory.connect(
    config.xALPACAv2RevenueDistributor!,
    deployer
  );

  const setPoolRewarder = await xALPACAv2RevenueDistributor.addRewarders(REWARDER);

  console.log(`✅ Done at: ${setPoolRewarder.hash}`);
};
export default func;
func.tags = ["AddRewardersxALPACAv2RevenueDistributor"];
