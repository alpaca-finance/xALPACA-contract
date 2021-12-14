import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@openzeppelin/test-helpers";
import { AlpacaFeeder__factory, GrassHouse__factory, ProxyToken__factory, XALPACA__factory } from "../typechain";
import { ConfigEntity } from "../deploy/entities";
import TestnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.testnet.json";
import MainnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.mainnet.json";
import { WorkersEntity } from "../deploy/interfaces/config";
import {
  CakeMaxiWorker__factory,
  MdexWorker02__factory,
  PancakeswapV2Worker__factory,
  Vault,
} from "@alpaca-finance/alpaca-contract/typechain";

interface IDexRouter {
  pancakeswap: string;
  waultswap: string;
  mdex: string;
}

const config = ConfigEntity.getConfig();
async function validateXAlpaca() {
  const xALPACA = XALPACA__factory.connect(config.xALPACA, ethers.provider);
  expect(xALPACA.token).to.be.eq(config.Tokens.ALPACA);
}

async function validateProxyToken() {
  const proxyToken = ProxyToken__factory.connect(config.Tokens.fdALPACA, ethers.provider);
  expect(proxyToken.timelock).to.be.eq(config.Timelock);
}

async function validateGrassHouse() {
  const grassHouses = config.GrassHouses;
  for (const grassHouse of grassHouses) {
    const grassHouseConnect = GrassHouse__factory.connect(grassHouse.address, ethers.provider);
    expect(grassHouseConnect.rewardToken).to.be.eq(grassHouse.rewardToken);
  }
}

async function validateAlpacaFeeder() {
  const alpacaFeeder = AlpacaFeeder__factory.connect(config.ALPACAFeeder, ethers.provider);
  const alpacaGrassHouse = config.GrassHouses.find((gh) => gh.rewardToken === config.Tokens.ALPACA);
  if (!alpacaGrassHouse) throw new Error(`Cannot find ALPACA GrassHouse`);
  expect(alpacaFeeder.token()).to.be.eq(config.Tokens.ALPACA);
  expect(alpacaFeeder.proxyToken()).to.be.eq(config.Tokens.fdALPACA);
  expect(alpacaFeeder.fairLaunch()).to.be.eq(config.FairLaunch);
  expect(alpacaFeeder.grassHouse()).to.be.eq(alpacaGrassHouse?.address);
}

async function validateWorkersConfig(vault: Vault, workerInfo: WorkersEntity, routers: IDexRouter) {
  console.log(`> validating ${workerInfo.name}`);
  if (workerInfo.name.includes("PancakeswapWorker")) {
    const worker = PancakeswapV2Worker__factory.connect(workerInfo.address, ethers.provider);
  } else if (workerInfo.name.includes("MdexWorker")) {
    const worker = MdexWorker02__factory.connect(workerInfo.address, ethers.provider);
  } else if (workerInfo.name.includes("CakeMaxiWorker")) {
    const worker = CakeMaxiWorker__factory.connect(workerInfo.address, ethers.provider);
  }
}

async function main() {
  console.log("=== validate xALPACA ===");
  try {
    await Promise.all([validateXAlpaca()]);
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
