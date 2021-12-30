import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { getConfig } from "../../deploy/entities/config";
import { BEP20__factory, GrassHouse, GrassHouse__factory } from "../../typechain";

async function main() {
  if (network.name !== "mainnetfork") throw new Error("not mainnet fork");

  const config = getConfig();
  const [deployer] = await ethers.getSigners();
  const alpaca = BEP20__factory.connect("0x9fd87aefe02441b123c3c32466cd9db4c578618f", deployer);
  const oldGrassHouse = GrassHouse__factory.connect(config.GrassHouses[1].address, deployer);

  const GrassHouse = await ethers.getContractFactory("GrassHouse", deployer);
  const newGrassHouse = (await upgrades.deployProxy(GrassHouse, [
    config.xALPACA,
    1639612800,
    "0x9fd87aefe02441b123c3c32466cd9db4c578618f",
    deployer.address,
  ])) as GrassHouse;

  let nonce = await deployer.getTransactionCount();

  // Kill old grass house
  console.log("> Killing old GrassHouse");
  let deployAlpacaBefore = await alpaca.balanceOf(deployer.address);
  await oldGrassHouse.kill({ nonce: nonce++ });
  let deployAlpacaAfter = await alpaca.balanceOf(deployer.address);
  console.log("> Done");

  expect(deployAlpacaAfter).to.be.gt(deployAlpacaBefore);
  const fedALPACA = deployAlpacaAfter.sub(deployAlpacaBefore);
  console.log("> Fed ", fedALPACA.toString());

  await alpaca.approve(newGrassHouse.address, ethers.BigNumber.from("3652500000000000000000"), { nonce: nonce++ });
  await newGrassHouse.injectReward(1640217600, ethers.BigNumber.from("3652500000000000000000"), { nonce: nonce++ });
  await newGrassHouse.checkpointTotalSupply({ nonce: nonce++ });
  await newGrassHouse.checkpointToken({ nonce: nonce++ });

  console.log(
    "> claim: ",
    (await newGrassHouse.callStatic.claim("0x3031516A28428a07B95C7a7cdBcaE6c353804367")).toString()
  );
  console.log("> totalSupply at 23th: ", (await newGrassHouse.totalSupplyAt(1640217600)).toString());
  console.log(
    "> my balance at 23th: ",
    (await newGrassHouse.balanceOfAt("0x3031516A28428a07B95C7a7cdBcaE6c353804367", 1640217600)).toString()
  );
  console.log("> weekCursor: ", (await newGrassHouse.weekCursor()).toString());
  console.log("> lastTokenTimestamp: ", (await newGrassHouse.lastTokenTimestamp()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
