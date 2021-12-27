import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@openzeppelin/test-helpers";
import { ProxyToken__factory } from "../../typechain";
import { ConfigEntity } from "../../deploy/entities";

const config = ConfigEntity.getConfig();
async function validateProxyToken() {
  console.log(`=== validate proxy token ===`);
  const proxyToken = ProxyToken__factory.connect(config.Tokens.fdALPACA, ethers.provider);
  expect(await proxyToken.okHolders(config.FairLaunch.address)).to.be.eq(true);
  expect(await proxyToken.okHolders(config.ALPACAFeeder)).to.be.eq(true);
}

async function main() {
  console.log("=== validate fdALPACA ===");
  try {
    await Promise.all([validateProxyToken()]);
    console.log("> ✅ Done");
  } catch (e) {
    console.log("> ❌ some problem found");
    console.log(e);
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
