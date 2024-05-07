import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { XALPACAv2Rewarder__factory } from "../../../../typechain";
import { ConfigEntity } from "../../../entities";
import { getDeployer } from "../../../../utils/deployer-helper";

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

  const config = ConfigEntity.getConfig();

  const REWARDER_NAME = "PYTH";
  const accounts: string[] = [];

  const rewarder = config.xALPACAv2Rewarders.find((rw) => rw.name === REWARDER_NAME);
  if (!rewarder) {
    console.log(`>> ${REWARDER_NAME} Rewarder not found`);
    return;
  }

  const rewarderContract = XALPACAv2Rewarder__factory.connect(rewarder.address, ethers.provider);

  let counter: number = 0;
  const badAccounts: string[] = [];

  for (const account of accounts) {
    await rewarderContract.pendingToken(account).catch((e) => {
      console.log(">> Error:", account);
      badAccounts.push(account);
    });
    counter++;
  }

  if (counter !== accounts.length) {
    console.log(`>> Exited before checking all accounts. ${counter} of ${accounts.length} checked.`);
  }

  console.log(`>> ${REWARDER_NAME} Rewarder bad accounts: ${badAccounts.length}`);
  console.log(badAccounts);

  console.log(`✅ Done`);
};

export default func;
func.tags = ["FindPendingTokens"];
