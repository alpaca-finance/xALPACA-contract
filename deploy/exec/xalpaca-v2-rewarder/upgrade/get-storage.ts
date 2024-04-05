import { ethers, upgrades } from "hardhat";
import { XALPACAv2Rewarder__factory } from "../../../../typechain";
import { getDeployer } from "../../../../utils/deployer-helper";
import { ConfigEntity } from "../../../entities";

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

  const REWARDER_ADDRESS = config.xALPACAv2Rewarders[0].address;

  let i = 0;
  while (1) {
    console.log(`Reading slot${i}`);
    const slotValue = await ethers.provider.getStorageAt(REWARDER_ADDRESS, i);
    if (slotValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`slot${i}: `, await ethers.provider.getStorageAt(REWARDER_ADDRESS, i));
    }
    i++;
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
