import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  interface IUserInfo {
    user: string;
    rewardDebt: number;
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
  const REWARDER = "PYTH";
  const USERLIST: Array<IUserInfo> = [
    {
      user: "0x1300dedfb2f9671b6435dd4cb7ac40a5a3be51ff",
      rewardDebt: 154288683,
    },
    {
      user: "0x04938ffb0c749a11fcda6d5138a95b1cd76791d0",
      rewardDebt: 0,
    },
    {
      user: "0xa25ad78e8bf1ff9e5872662934ec4984b92611ff",
      rewardDebt: 929,
    },
    {
      user: "0x08943873222ce63ec48f8907757928dcb06af388",
      rewardDebt: 389259,
    },
    {
      user: "0xc3fd2bcb524af31963b3e3bb670f28ba14718244",
      rewardDebt: 4027249,
    },
    {
      user: "0x8bc888a4738f1e4291e041cbb225156da8f42059",
      rewardDebt: 1083460,
    },
    {
      user: "0xc8d5aca8fd339846d98bd246aee47f767daa1075",
      rewardDebt: 21643899,
    },
    {
      user: "0x0567d99a4420b8da0fd91c5ecba78955c04974f0",
      rewardDebt: 1713434087,
    },
    {
      user: "0x539ec9fe37320828cdf639c2de93cbf1d1e5d257",
      rewardDebt: 2087504,
    },
    {
      user: "0xc110c1cd06e00273a770ef1555d2a8497aadff41",
      rewardDebt: 13441254,
    },
    {
      user: "0x736b9564c98325df57e3251d405a883fa85918fd",
      rewardDebt: 1715939580,
    },
    {
      user: "0x902736ba2f6558332efbadb4a731af786e55f4b9",
      rewardDebt: 37602,
    },
    {
      user: "0xcffb39005a8dab478ef4188ae1b912f6e28ee3d3",
      rewardDebt: 15207029,
    },
    {
      user: "0x8674b6f34aa08aa8fa3d09551688e8cec70540ae",
      rewardDebt: 150005014,
    },
    {
      user: "0xbe68b3a1b22e84a89a8b3d47bcec8fba3fe0cc75",
      rewardDebt: 1023506,
    },
  ];

  const deployer = await getDeployer();
  const config = ConfigEntity.getConfig();

  const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === REWARDER);
  console.log(rewarder);
  if (!rewarder) {
    console.log(`>> ${REWARDER} Rewarder not found`);
    return;
  }

  const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

  for (const user of USERLIST) {
    console.log(
      `>> Setting ${user.rewardDebt} as a new reward debt for ${user.user} at Rewarder ${rewarder.name} at ${rewarder.address}`
    );
    await rewarderAsDeployer.forceSetUserRewardDebt(user.user, user.rewardDebt);
  }
  console.log(`✅ Done`);
};

export default func;
func.tags = ["RewarderForceSetRewardDebt"];
