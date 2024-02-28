import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { BEP20__factory, XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IRewarder {
    NAME: string;
    AMOUNT: string;
    REWARD_END_TIMESTAMP: string;
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
  const REWARDERS: Array<IRewarder> = [
    {
      NAME: "PYTH",
      AMOUNT: "50000",
      REWARD_END_TIMESTAMP: "",
      DECIMAL: 6,
    },
  ];

  const deployer = (await ethers.getSigners())[0];
  const config = ConfigEntity.getConfig();

  for (const rewarderConfig of REWARDERS) {
    const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === rewarderConfig.NAME);
    console.log(rewarder);
    if (!rewarder) {
      console.log(`>> ${rewarderConfig.NAME} Rewarder not found`);
      continue;
    }
    console.log(
      `>> Feeding ${rewarderConfig.AMOUNT} ${rewarder.name} to Rewarder ${rewarder.name} at ${rewarder.address}`
    );
    const rewardTokenAsDeployer = BEP20__factory.connect(rewarder.rewardToken, deployer);
    const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

    await rewardTokenAsDeployer.approve(rewarder.address, ethers.utils.parseEther(rewarderConfig.AMOUNT));
    await rewarderAsDeployer.feed(
      Number(rewarderConfig.AMOUNT) * 10 ** rewarderConfig.DECIMAL,
      Number(rewarderConfig.REWARD_END_TIMESTAMP)
    );
    console.log(
      `✅ Done Feed ${rewarderConfig.AMOUNT} ${rewarder.name} to Rewarder ${rewarder.name} at ${rewarder.address} ending at ${rewarderConfig.REWARD_END_TIMESTAMP} `
    );
  }
};

export default func;
func.tags = ["FeedRewarder"];
