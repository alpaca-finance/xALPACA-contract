import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@openzeppelin/test-helpers";
import { AlpacaFeeder__factory, GrassHouse__factory, ProxyToken__factory, XALPACA__factory } from "../typechain";
import { ConfigEntity } from "../deploy/entities";
import TestnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.testnet.json";
import MainnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.mainnet.json";
import { WorkersEntity } from "../deploy/interfaces/config";
import {
  CakeMaxiWorker02__factory,
  MdexWorker02__factory,
  PancakeswapV2Worker02__factory,
  WorkerConfig__factory,
} from "@alpaca-finance/alpaca-contract/typechain";

const config = ConfigEntity.getConfig();
async function validateXAlpaca() {
  const xALPACA = XALPACA__factory.connect(config.xALPACA, ethers.provider);
  expect(await xALPACA.token()).to.be.eq(config.Tokens.ALPACA);
}

async function validateProxyToken() {
  console.log(`=== validate proxy token ===`);
  const proxyToken = ProxyToken__factory.connect(config.Tokens.fdALPACA, ethers.provider);
  expect(await proxyToken.okHolders(config.FairLaunch.address)).to.be.eq(true);
  expect(await proxyToken.okHolders(config.ALPACAFeeder)).to.be.eq(true);
}

async function validateGrassHouse() {
  console.log(`=== validate grassHouse ===`);
  const grassHouses = config.GrassHouses;
  for (const grassHouse of grassHouses) {
    const grassHouseConnect = GrassHouse__factory.connect(grassHouse.address, ethers.provider);
    expect(await grassHouseConnect.rewardToken()).to.be.eq(grassHouse.rewardToken);
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
}

async function validateWorkersConfig(workerInfo: WorkersEntity) {
  console.log(`> validating ${workerInfo.name}`);
  if (workerInfo.name.includes("PancakeswapWorker")) {
    const worker = PancakeswapV2Worker02__factory.connect(workerInfo.address, ethers.provider);
    try {
      // expect(await worker.treasuryBountyBps()).to.be.eq("300");
      expect(await worker.maxReinvestBountyBps()).to.be.eq("500");
      // expect(await worker.reinvestBountyBps()).to.be.eq("300");
      // expect(await worker.reinvestThreshold()).to.be.eq("1");
      // expect(await worker.beneficialVaultBountyBps()).to.be.eq("5263");
      // expect(await worker.beneficialVault()).to.be.eq(config.ALPACAFeeder);
    } catch (e) {
      console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
      console.log(e);
    }
  }
  // } else if (workerInfo.name.includes("MdexWorker")) {
  //   const worker = MdexWorker02__factory.connect(workerInfo.address, ethers.provider);
  //   try {
  //     expect(await worker.treasuryBountyBps()).to.be.eq("900");
  //     expect(await worker.maxReinvestBountyBps()).to.be.eq("900");
  //     expect(await worker.reinvestBountyBps()).to.be.eq("300");
  //     expect(await worker.reinvestThreshold()).to.be.eq("1");
  //   } catch (e) {
  //     console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
  //     console.log(e);
  //   }
  // } else if (workerInfo.name.includes("CakeMaxiWorker")) {
  //   const worker = CakeMaxiWorker02__factory.connect(workerInfo.address, ethers.provider);
  //   try {
  //     expect(await worker.treasuryBountyBps()).to.be.eq("1900");
  //     expect(await worker.beneficialVaultBountyBps()).to.be.eq("5263");
  //     // expect(await worker.beneficialVault()).to.be.eq(config.ALPACAFeeder);
  //   } catch (e) {
  //     console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
  //     console.log(e);
  //   }
  // }
}

async function main() {
  const configAlpaca = network.name === "mainnet" ? MainnetAlpacaConfig : TestnetAlpacaConfig;
  console.log("=== validate xALPACA ===");
  try {
    await Promise.all([validateXAlpaca(), validateProxyToken(), validateGrassHouse(), validateAlpacaFeeder()]);
    console.log("> ✅ Done");
  } catch (e) {
    console.log("> ❌ some problem found");
    console.log(e);
  }

  const lpWorkerConfig = WorkerConfig__factory.connect(configAlpaca.SharedConfig.WorkerConfig, ethers.provider);
  const cakeMaxiWorkerConfig = WorkerConfig__factory.connect(
    configAlpaca.SharedConfig.PancakeswapSingleAssetWorkerConfig,
    ethers.provider
  );

  const results: Array<WorkersEntity> = [];

  for (let i = 0; i < configAlpaca.Vaults.length; i++) {
    for (let j = 0; j < configAlpaca.Vaults[i].workers.length; j++) {
      const worker = configAlpaca.Vaults[i].workers[j];
      if (worker.name.indexOf("CakeMaxiWorker") === -1) {
        const eachWorkerConfig = await lpWorkerConfig.workers(configAlpaca.Vaults[i].workers[j].address);
        if (eachWorkerConfig.acceptDebt === false) {
          continue;
        }
      } else {
        const eachWorkerConfig = await cakeMaxiWorkerConfig.workers(configAlpaca.Vaults[i].workers[j].address);
        if (eachWorkerConfig.acceptDebt === false) {
          continue;
        }
      }

      results.push(configAlpaca.Vaults[i].workers[j]);
    }
  }
  const validateWorkers = [];
  for (const worker of results) {
    validateWorkers.push(validateWorkersConfig(worker));
  }
  await Promise.all(validateWorkers);
  await delay(3000);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
