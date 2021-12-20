import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@openzeppelin/test-helpers";
import { ERC20__factory } from "../../typechain";
import { ConfigEntity } from "../../deploy/entities";
import TestnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.testnet.json";
import MainnetAlpacaConfig from "@alpaca-finance/alpaca-contract/.mainnet.json";
import { WorkersEntity } from "../../deploy/interfaces/config";
import {
  CakeMaxiWorker02__factory,
  FairLaunch__factory,
  MdexWorker02__factory,
  PancakeswapV2Worker02__factory,
  WorkerConfig__factory,
} from "@alpaca-finance/alpaca-contract/typechain";

const config = ConfigEntity.getConfig();

async function validateFairLaunch() {
  const IBALPACA_POOL_ID = 11;
  const FDALPACA_POOL_ID = 21;
  const fl = FairLaunch__factory.connect(config.FairLaunch.address, ethers.provider);
  const fdALPACAPool = await fl.poolInfo(ethers.BigNumber.from(FDALPACA_POOL_ID));
  const ibALPACAPool = await fl.poolInfo(ethers.BigNumber.from(IBALPACA_POOL_ID));

  expect(fdALPACAPool.allocPoint).to.be.eq("300");
  expect(ibALPACAPool.allocPoint).to.be.eq("0");
}

async function validateWorkersConfig(workerInfo: WorkersEntity) {
  console.log(`> validating ${workerInfo.name}`);
  if (workerInfo.name.includes("PancakeswapWorker")) {
    const worker = PancakeswapV2Worker02__factory.connect(workerInfo.address, ethers.provider);
    const reinvestPathSymbols: Array<string> = [];

    const reinvestPath = await worker.getReinvestPath();
    for (const p of reinvestPath) {
      const token = ERC20__factory.connect(p, ethers.provider);
      reinvestPathSymbols.push(await token.symbol());
    }

    try {
      expect(await worker.treasuryBountyBps()).to.be.eq("900");
      expect(await worker.maxReinvestBountyBps()).to.be.eq("900");
      expect(await worker.reinvestBountyBps()).to.be.eq("900");
      expect(await worker.reinvestThreshold()).to.be.eq("1000000000000000000");
      expect(await worker.beneficialVaultBountyBps()).to.be.eq("5555");
      expect(await worker.beneficialVault()).to.be.eq(config.ALPACAFeeder);
      if (workerInfo.name.includes("-TUSD")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "BUSD", "TUSD"]);
      } else if (workerInfo.name.includes("-BTCB")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "WBNB", "BTCB"]);
      } else if (workerInfo.name.includes("-USDT")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "USDT"]);
      } else if (workerInfo.name.includes("BUSD-ALPACA")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "BUSD", "ALPACA"]);
      } else if (workerInfo.name.includes("-ETH")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "WBNB", "ETH"]);
      } else if (workerInfo.name.includes("-BUSD")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "BUSD"]);
      } else if (workerInfo.name.includes("-WBNB")) {
        expect(reinvestPathSymbols).to.be.eql(["Cake", "WBNB"]);
      }
    } catch (e) {
      console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
      console.log(e);
    }
  } else if (workerInfo.name.includes("MdexWorker")) {
    const worker = MdexWorker02__factory.connect(workerInfo.address, ethers.provider);
    const reinvestPathSymbols: Array<string> = [];
    const reinvestPath = await worker.getReinvestPath();
    for (const p of reinvestPath) {
      const token = ERC20__factory.connect(p, ethers.provider);
      reinvestPathSymbols.push(await token.symbol());
    }
    try {
      expect(await worker.treasuryBountyBps()).to.be.eq("900");
      expect(await worker.maxReinvestBountyBps()).to.be.eq("900");
      expect(await worker.reinvestBountyBps()).to.be.eq("900");
      expect(await worker.reinvestThreshold()).to.be.eq("330000000000000000000");
      if (workerInfo.name.includes("-BTCB")) {
        expect(reinvestPathSymbols).to.be.eql(["MDX", "WBNB", "BTCB"]);
      } else if (workerInfo.name.includes("-USDT")) {
        expect(reinvestPathSymbols).to.be.eql(["MDX", "USDT"]);
      } else if (workerInfo.name.includes("-ETH")) {
        expect(reinvestPathSymbols).to.be.eql(["MDX", "ETH"]);
      } else if (workerInfo.name.includes("-BUSD")) {
        expect(reinvestPathSymbols).to.be.eql(["MDX", "BUSD"]);
      } else if (workerInfo.name.includes("-WBNB")) {
        expect(reinvestPathSymbols).to.be.eql(["MDX", "WBNB"]);
      }
    } catch (e) {
      console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
      console.log(e);
    }
  } else if (workerInfo.name.includes("CakeMaxiWorker")) {
    const worker = CakeMaxiWorker02__factory.connect(workerInfo.address, ethers.provider);
    try {
      expect(await worker.beneficialVaultBountyBps()).to.be.eq("5263");
      expect(await worker.beneficialVault()).to.be.eq(config.ALPACAFeeder);
    } catch (e) {
      console.log(`> ❌ some problem found in ${workerInfo.name}, please double check`);
      console.log(e);
    }
  }
}

async function main() {
  const configLYF = network.name === "mainnet" ? MainnetAlpacaConfig : TestnetAlpacaConfig;
  try {
    await Promise.all([validateFairLaunch()]);
    console.log("> ✅ Done");
  } catch (e) {
    console.log("> ❌ some problem found");
    console.log(e);
  }

  const lpWorkerConfig = WorkerConfig__factory.connect(configLYF.SharedConfig.WorkerConfig, ethers.provider);
  const cakeMaxiWorkerConfig = WorkerConfig__factory.connect(
    configLYF.SharedConfig.PancakeswapSingleAssetWorkerConfig,
    ethers.provider
  );

  const results: Array<WorkersEntity> = [];

  const exception = [
    "BETH-ETH PancakeswapWorker",
    "BRY-WBNB PancakeswapWorker",
    "BOR-WBNB PancakeswapWorker",
    "ITAM-WBNB PancakeswapWorker",
    "BORING-WBNB PancakeswapWorker",
    "TRX-WBNB PancakeswapWorker",
    "BTT-WBNB PancakeswapWorker",
  ];

  for (let i = 0; i < configLYF.Vaults.length; i++) {
    for (let j = 0; j < configLYF.Vaults[i].workers.length; j++) {
      const worker = configLYF.Vaults[i].workers[j];
      if (worker.name.includes("WaultswapWorker") || exception.includes(configLYF.Vaults[i].workers[j].name)) {
        continue;
      }
      if (worker.name.indexOf("CakeMaxiWorker") === -1) {
        const eachWorkerConfig = await lpWorkerConfig.workers(configLYF.Vaults[i].workers[j].address);
        if (eachWorkerConfig.acceptDebt === false) {
          console.log(worker.name);
          continue;
        }
      } else {
        const eachWorkerConfig = await cakeMaxiWorkerConfig.workers(configLYF.Vaults[i].workers[j].address);
        if (eachWorkerConfig.acceptDebt === false) {
          console.log(worker.name);
          continue;
        }
      }

      results.push(configLYF.Vaults[i].workers[j]);
    }
  }
  results.sort((a, b) => (a.name.split(" ")[1] > b.name.split(" ")[1] ? 1 : -1));
  const validateWorkers = [];
  for (const worker of results) {
    validateWorkers.push(validateWorkersConfig(worker));
    console.log(worker.name);
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
