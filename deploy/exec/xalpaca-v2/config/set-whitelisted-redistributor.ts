import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { XALPACAv2__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { getConfig } from "../../../entities/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const config = getConfig();
  /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝Ø
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */

  const WHITELISTED_CALLERS = ["0xe45216Ac4816A5Ec5378B1D13dE8aA9F262ce9De"];
  const IS_OK_CALLER = true;

  const deployer = await getDeployer();

  const xALPACAv2RevenueDistributor = XALPACAv2__factory.connect(config.xALPACAv2!, deployer);

  const setWhitelistedRedistributorTx = await xALPACAv2RevenueDistributor.setWhitelistedRedistributors(
    WHITELISTED_CALLERS,
    IS_OK_CALLER
  );

  console.log(`✅ Done at: ${setWhitelistedRedistributorTx.hash}`);
};
export default func;
func.tags = ["SetWhitelistedRedistributorxALPACAv2"];
