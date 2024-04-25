import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { BEP20__factory, XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IRewarder {
    NAME: string;
    AMOUNT: string;
    DECIMAL: number;
  }
  /*
          ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
          ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
          ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
          ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
          ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
          ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
          Check all variables below before execute the deployment script
    */
  const REWARDER = {
    NAME: "PYTH",
    AMOUNT: "175.26",
    DECIMAL: 6,
  };

  const user = "";
  const newRewardDebt = 0;

  const deployer = await getDeployer();
  const config = ConfigEntity.getConfig();

  const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === REWARDER.NAME);
  console.log(rewarder);
  if (!rewarder) {
    console.log(`>> ${REWARDER.NAME} Rewarder not found`);
    return;
  }
  console.log(
    `>> Withdrawing ${REWARDER.AMOUNT} ${rewarder.name} from Rewarder ${rewarder.name} at ${rewarder.address}`
  );
  const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

  await rewarderAsDeployer.forceSetReward(user, newRewardDebt);
  console.log(`✅ Done withdraw ${REWARDER.AMOUNT} ${rewarder.name} to ${deployer.address}`);
};

export default func;
func.tags = ["RewarderWithdraw"];
