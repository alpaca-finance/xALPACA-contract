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

  const POOL_REWARDERS: string[] = [];

  const deployer = await getDeployer();

  const xALPACAv2RevenueDistributor = XALPACAv2RevenueDistributor__factory.connect(
    config.xALPACAv2RevenueDistributor!,
    deployer
  );

  const setPoolRewarder = await xALPACAv2RevenueDistributor.setPoolRewarders(POOL_REWARDERS);

  console.log(`✅ Done at: ${setPoolRewarder.hash}`);
};
export default func;
func.tags = ["SetPoolRewardersxALPACAv2RevenueDistributor"];
