import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";
import { BigNumber } from "ethers";

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
  const REWARDER = "PYTH";

  const user = "";
  const newRewardDebt = 0;

  const deployer = await getDeployer();
  const config = ConfigEntity.getConfig();

  const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === REWARDER);
  console.log(rewarder);
  if (!rewarder) {
    console.log(`>> ${REWARDER} Rewarder not found`);
    return;
  }
  console.log(`>> Setting reward debt for ${user} from Rewarder ${rewarder.name} at ${rewarder.address}`);
  const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

  await rewarderAsDeployer.forceSetReward(user, newRewardDebt);
  console.log(`✅ Done`);
};

export default func;
func.tags = ["RewarderForceSetReward"];
