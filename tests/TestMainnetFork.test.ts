import { ethers, waffle, upgrades, network } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
  MockGrassHouse,
  MockGrassHouse__factory,
  AlpacaFeeder,
  AlpacaFeeder__factory,
  IFairLaunch,
  IFairLaunch__factory,
  ERC20__factory,
} from "../typechain";

chai.use(solidity);
const { expect } = chai;

async function main() {
  if (network.name !== "mainnetfork") throw new Error("not mainnet fork");
  const [deployer, qa] = await ethers.getSigners();
  const fairLaunch = IFairLaunch__factory.connect("0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F", deployer);
  const alpacaTokenAsDeployer = BEP20__factory.connect("0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F", deployer);
  const totalSupply = await alpacaTokenAsDeployer.totalSupply();
  const balance = await alpacaTokenAsDeployer.balanceOf("0x2DD872C6f7275DAD633d7Deb1083EDA561E9B96b");
  console.log(balance);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
