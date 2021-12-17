import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@openzeppelin/test-helpers";
import { AlpacaFeeder__factory, BEP20__factory, GrassHouse__factory, XALPACA__factory } from "../../typechain";
import { ConfigEntity } from "../../deploy/entities";
import * as addresses from "../../tests/constants/addresses";
import { FairLaunch__factory } from "@alpaca-finance/alpaca-contract/typechain";

const config = ConfigEntity.getConfig();
async function validateFairLaunch() {
  console.log("=== validate Fairlaunch fdALPACA pool ===");
  const FDALPACA_POOL_ID = 22;
  const fl = FairLaunch__factory.connect(config.FairLaunch.address, ethers.provider);
  const fdALPACAPool = await fl.poolInfo(ethers.BigNumber.from(FDALPACA_POOL_ID));

  expect(fdALPACAPool.stakeToken).to.be.eq(config.Tokens.fdALPACA);
}
async function validateXAlpaca() {
  console.log("=== validate xALPACA ===");
  const MAX_LOCK = ethers.BigNumber.from(32054399);
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);
  const xALPACA = XALPACA__factory.connect(config.xALPACA, ethers.provider);
  const ALPACA = BEP20__factory.connect(config.Tokens.ALPACA, ethers.provider);
  expect(await xALPACA.token()).to.be.eq(config.Tokens.ALPACA);
  expect(await xALPACA.name()).to.be.eq("xALPACA");
  expect(await xALPACA.symbol()).to.be.eq("xALPACA");
  expect(await xALPACA.decimals()).to.be.eq(await ALPACA.decimals());
  expect(await xALPACA.token()).to.be.eq(ALPACA.address);
  expect(await xALPACA.MAX_LOCK()).to.be.eq(MAX_LOCK);
  expect(await xALPACA.WEEK()).to.be.eq(WEEK);

  const pointHistory0 = await xALPACA.pointHistory(0);
  expect(pointHistory0.bias).to.be.eq(0);
  expect(pointHistory0.slope).to.be.eq(0);
  expect(pointHistory0.timestamp).to.be.gt(0);
  expect(pointHistory0.blockNumber).to.be.gt(0);
}

async function validateALPACAGrassHouse() {
  console.log(`=== validate ALPACA GrassHouse ===`);
  const grassHouses = config.GrassHouses;
  const startWeekCursor = 1640217600; // 23 Dec 2021 00:00 UTC
  for (const grassHouse of grassHouses) {
    const grassHouseConnect = GrassHouse__factory.connect(grassHouse.address, ethers.provider);
    expect(await grassHouseConnect.rewardToken()).to.be.eq(grassHouse.rewardToken);
    expect(await grassHouseConnect.startWeekCursor()).to.be.eq(startWeekCursor);
    expect(await grassHouseConnect.lastTokenTimestamp()).to.be.eq(startWeekCursor);
    expect(await grassHouseConnect.weekCursor()).to.be.eq(startWeekCursor);
    expect(await grassHouseConnect.rewardToken()).to.be.eq(config.Tokens.ALPACA);
    expect(await grassHouseConnect.xALPACA()).to.be.eq(config.xALPACA);
    expect(await grassHouseConnect.emergencyReturn()).to.be.eq(addresses.DEPLOYER);
    expect(await grassHouseConnect.canCheckpointToken()).to.be.eq(false);
  }
}

async function validateAlpacaFeeder() {
  console.log(`=== validate AlpacaFeeder ===`);
  const alpacaFeeder = AlpacaFeeder__factory.connect(config.ALPACAFeeder, ethers.provider);
  const alpacaGrassHouse = config.GrassHouses.find((gh) => gh.rewardToken === config.Tokens.ALPACA);
  if (!alpacaGrassHouse) throw new Error(`Cannot find ALPACA GrassHouse`);
  expect(await alpacaFeeder.token()).to.be.eq(config.Tokens.ALPACA);
  expect(await alpacaFeeder.proxyToken()).to.be.eq(config.Tokens.fdALPACA);
  expect(await alpacaFeeder.fairLaunch()).to.be.eq(config.FairLaunch.address);
  expect(await alpacaFeeder.grassHouse()).to.be.eq(alpacaGrassHouse?.address);
  expect(await alpacaFeeder.owner()).to.be.eq(addresses.DEPLOYER);
}
async function main() {
  try {
    await Promise.all([validateFairLaunch(), validateALPACAGrassHouse(), validateXAlpaca(), validateAlpacaFeeder()]);
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
