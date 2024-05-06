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

  const user = "0xd09fA948296E54D1Ab73A0497C16403A08A84732";
  const newRewardDebt = 524935147;

  const deployer = await getDeployer();
  const config = ConfigEntity.getConfig();

  const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === REWARDER);
  console.log(rewarder);
  if (!rewarder) {
    console.log(`>> ${REWARDER} Rewarder not found`);
    return;
  }
  console.log(
    `>> Setting ${newRewardDebt} as a new reward debt for ${user} at Rewarder ${rewarder.name} at ${rewarder.address}`
  );
  const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

  await rewarderAsDeployer.forceSetUserRewardDebt(user, newRewardDebt);
  console.log(`✅ Done`);
};

export default func;
func.tags = ["RewarderForceSetRewardDebt"];