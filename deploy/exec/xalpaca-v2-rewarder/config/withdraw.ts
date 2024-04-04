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
  const REWARDERS: Array<IRewarder> = [
    {
      NAME: "PYTH",
      AMOUNT: "1",
      DECIMAL: 6,
    },
  ];

  const deployer = await getDeployer();
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
    const rewarderAsDeployer = XALPACAv2Rewarder__factory.connect(rewarder.address, deployer);

    await rewarderAsDeployer.withdrawTo(
      deployer.address,
      BigNumber.from(Number(rewarderConfig.AMOUNT) * 10 ** rewarderConfig.DECIMAL)
    );
    console.log(`✅ Done withdraw ${rewarderConfig.AMOUNT} ${rewarder.name} to ${deployer.address}`);
  }
};

export default func;
func.tags = ["RewarderWithdraw"];
