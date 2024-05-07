import { ethers, upgrades } from "hardhat";
import { XALPACAv2Rewarder, XALPACAv2Rewarder__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { ConfigEntity, TimelockEntity } from "../../../entities";
import { fileService } from "../../../services";
import { MaybeMultisigTimelock } from "../../../services/timelock/maybe-multisig";

async function main() {
  const config = ConfigEntity.getConfig();
  /*
    ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
    ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
    ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
    ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
    ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
    ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
    Check all variables below before execute the deployment script
*/

  const deployer = await getDeployer();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const TITLE = "upgrade_xalpacav2rewarder";
  const REWARDER_ADDRESS = config.xALPACAv2Rewarders[0].address;
  const EXACT_ETA = "1712410200";
  let NONCE = 21870;

  const xALPACAv2RewarderFactory = new XALPACAv2Rewarder__factory(deployer);

  console.log(`> Upgrading xALPACAv2Rewarder at ${REWARDER_ADDRESS} through Timelock + ProxyAdmin`);
  console.log("> Prepare upgrade & deploy if needed a new IMPL automatically.");
  const preparedImpl = await upgrades.prepareUpgrade(REWARDER_ADDRESS, xALPACAv2RewarderFactory);
  console.log(`> Implementation address: ${preparedImpl.toString()}`);

  const timelock = new MaybeMultisigTimelock(chainId, deployer);
  const timelockTransactions: Array<TimelockEntity.Transaction> = [];

  timelockTransactions.push(
    await timelock.queueTransaction(
      `> Queue tx to upgrade ${REWARDER_ADDRESS}`,
      config.ProxyAdmin,
      "0",
      "upgrade(address,address)",
      ["address", "address"],
      [REWARDER_ADDRESS, preparedImpl],
      EXACT_ETA,
      { nonce: NONCE++ }
    )
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const fileName = `${timestamp}_${TITLE}`;
  console.log(`> Writing File ${fileName}`);
  fileService.writeJson(fileName, timelockTransactions);
  console.log("✅ Done");
}

// main()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
