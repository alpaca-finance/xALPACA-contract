import { ethers, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { ProxyToken, ProxyToken__factory } from "../typechain";

chai.use(solidity);
const { expect } = chai;

const TIME_LOCK = "0x2D5408f2287BF9F9B05404794459a846651D0a59";
const FAIR_LAUNCH = "0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F";
const Deployer = "0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51";
// const ProxyAdmin = "0x5379F32C8D5F663EACb61eeF63F722950294f452";

async function main() {
  if (network.name !== "mainnetfork") throw new Error("not mainnet fork");
  const [deployer, alice] = await ethers.getSigners();
  const eta = 1636774728;
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [Deployer],
  });
  // const deployer = await ethers.getSigner(Deployer);
  const timelockAsDeployer = Timelock__factory.connect(TIME_LOCK, deployer);

  console.log(`>> Deploying proxyToken`);
  const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", deployer)) as ProxyToken__factory;
  const proxyToken = (await upgrades.deployProxy(PROXY_TOKEN, [`proxyToken`, `proxyToken`, TIME_LOCK])) as ProxyToken;
  await proxyToken.deployed();
  console.log(`>> Deployed at ${proxyToken.address}`);

  await timelockAsDeployer.queueTransaction(
    FAIR_LAUNCH,
    "0",
    "addPool(uint256,address,bool)",
    ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
    0
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
