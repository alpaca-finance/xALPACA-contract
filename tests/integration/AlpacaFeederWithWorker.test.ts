import { ethers, waffle, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  ProxyToken,
  ProxyToken__factory,
  GrassHouse,
  AlpacaFeeder,
  XALPACA,
  BEP20,
  BEP20__factory,
  XALPACA__factory,
  GrassHouse__factory,
  AlpacaFeeder__factory,
} from "../../typechain";
import {
  Timelock,
  Timelock__factory,
  FairLaunch__factory,
  FairLaunch,
  MdexWorker02,
  CakeMaxiWorker02,
  CakeMaxiWorker02__factory,
  MdexWorker02__factory,
  PancakeswapV2Worker02,
  PancakeswapV2Worker02__factory,
} from "@alpaca-finance/alpaca-contract/typechain";
import * as timeHelpers from "../helpers/time";
import { BigNumber, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { formatEther } from "ethers/lib/utils";

chai.use(solidity);
const { expect } = chai;

// contract's addresses
const TIME_LOCK = "0x2D5408f2287BF9F9B05404794459a846651D0a59";
const FAIR_LAUNCH = "0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F";
const DEPLOYER = "0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51";
const SHIELD = "0x1963f84395c8cf464e5483de7f2f434c3f1b4656";
const CAKEMAXI_WORKER = "0xecfB6E8BEceA9A65A5a367497230dF14F64A14C9";
const MDEX_WORKER = "0x5EffBF90F915B59cc967060740243037CE9E6a7E";
const PCS_WORKER = "0xE90C44C16705859931099E7565DA5d3c21F67273";
const ALPACA = "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const CAKE = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";
const MDEX = "0x9c65ab58d8d978db963e63f2bfb7121627e3a739";
const BUSD = "0xe9e7cea3dedca5984780bafc599bd69add087d56";

describe("AlpacaFeeder - Integration test", () => {
  let deployer: SignerWithAddress;

  // setting
  let poolId: BigNumber;

  let alpaca: BEP20;

  // contracts
  let xalpaca: XALPACA;
  let fairlaunch: FairLaunch;
  let timelock: Timelock;
  let alpacaFeeder: AlpacaFeeder;
  let proxyToken: ProxyToken;
  let grassHouse: GrassHouse;
  let worker: CakeMaxiWorker02;
  let mdexWorker: MdexWorker02;
  let pcsWorker: PancakeswapV2Worker02;

  async function fixture() {
    // const [bot, lyf] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEPLOYER],
    });
    deployer = await ethers.getSigner(DEPLOYER);

    // connect alpaca
    alpaca = await BEP20__factory.connect(ALPACA, deployer);
    // connect timelock
    timelock = await Timelock__factory.connect(TIME_LOCK, deployer);
    // connect fairlaunch
    fairlaunch = await FairLaunch__factory.connect(FAIR_LAUNCH, deployer);

    // console.log("Deploy xAlpaca");
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xalpaca = (await upgrades.deployProxy(XALPACA, [alpaca.address])) as XALPACA;
    await xalpaca.deployed();

    // console.log("Deploy PROXY Token");
    const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", deployer)) as ProxyToken__factory;
    proxyToken = (await upgrades.deployProxy(PROXY_TOKEN, [`proxyToken`, `proxyToken`, TIME_LOCK])) as ProxyToken;
    await proxyToken.deployed();

    // console.log("Deploy Grasshouse");
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    grassHouse = (await upgrades.deployProxy(GrassHouse, [
      xalpaca.address,
      await timeHelpers.latestTimestamp(),
      alpaca.address,
      deployer.address,
    ])) as GrassHouse;
    await grassHouse.deployed();

    poolId = await fairlaunch.poolLength();
    const executeTime = (await timeHelpers.latestTimestamp())
      .add(timeHelpers.duration.days(BigNumber.from(2)))
      .toNumber();
    await timelock.queueTransaction(
      SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
      executeTime
    );

    await timeHelpers.increaseTimestamp(timeHelpers.duration.days(ethers.BigNumber.from(2)));
    await timelock.executeTransaction(
      SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
      executeTime
    );

    // console.log("Deploy AlpacaFeeder");
    const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
    alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
      alpaca.address,
      proxyToken.address,
      fairlaunch.address,
      poolId,
      grassHouse.address,
    ])) as AlpacaFeeder;
    await alpacaFeeder.deployed();
    await proxyToken.setOkHolders([alpacaFeeder.address, fairlaunch.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);

    const executeTime2 = (await timeHelpers.latestTimestamp())
      .add(timeHelpers.duration.days(BigNumber.from(2)))
      .toNumber();

    worker = CakeMaxiWorker02__factory.connect(CAKEMAXI_WORKER, deployer);
    mdexWorker = MdexWorker02__factory.connect(MDEX_WORKER, deployer);
    pcsWorker = PancakeswapV2Worker02__factory.connect(PCS_WORKER, deployer);

    // set reinvest whitelist
    // CakeMaxiWorker
    await timelock.queueTransaction(
      CAKEMAXI_WORKER,
      "0",
      "setReinvestorOk(address[],bool)",
      ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
      executeTime2
    );
    // PancakeSwapWorker
    await timelock.queueTransaction(
      PCS_WORKER,
      "0",
      "setReinvestorOk(address[],bool)",
      ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
      executeTime2
    );
    // set beneficial vault for worker
    // CakeMaxiWorker
    await timelock.queueTransaction(
      CAKEMAXI_WORKER,
      "0",
      "setBeneficialVaultConfig(uint256,address,address[])",
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address[]"],
        [100, alpacaFeeder.address, [CAKE, WBNB, ALPACA]]
      ),
      executeTime2
    );
    // PancakeSwapWorker
    await timelock.queueTransaction(
      PCS_WORKER,
      "0",
      "setBeneficialVaultConfig(uint256,address,address[])",
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address[]"],
        [100, alpacaFeeder.address, [CAKE, WBNB, ALPACA]]
      ),
      executeTime2
    );

    // advance time block
    await timeHelpers.increaseTimestamp(timeHelpers.duration.days(ethers.BigNumber.from(2)));

    // execute set beneficial vault.
    // CakeMaxi Worker
    await timelock.executeTransaction(
      CAKEMAXI_WORKER,
      "0",
      "setBeneficialVaultConfig(uint256,address,address[])",
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address[]"],
        [100, alpacaFeeder.address, [CAKE, WBNB, ALPACA]]
      ),
      executeTime2
    );
    // PancakeSwapWorker
    await timelock.executeTransaction(
      PCS_WORKER,
      "0",
      "setBeneficialVaultConfig(uint256,address,address[])",
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address[]"],
        [100, alpacaFeeder.address, [CAKE, WBNB, ALPACA]]
      ),
      executeTime2
    );
    // Mdex
    await mdexWorker.setBeneficialVaultConfig(100, alpacaFeeder.address, [MDEX, BUSD, ALPACA]);

    // execute set reinvest whitelist
    // CakeMaxiWorker
    await timelock.executeTransaction(
      CAKEMAXI_WORKER,
      "0",
      "setReinvestorOk(address[],bool)",
      ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
      executeTime2
    );
    // PancakeSwapWorker
    await timelock.executeTransaction(
      PCS_WORKER,
      "0",
      "setReinvestorOk(address[],bool)",
      ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
      executeTime2
    );
    // Mdex
    await mdexWorker.setReinvestorOk([deployer.address], true);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("AlpacaFeeder", () => {
    context("when CakeMaxi worker is triggered reinvest", () => {
      it("should send alpaca to AlpacaFeeder(CakeMaxi)", async () => {
        console.log("reinvest CakeMaxi");
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        console.log(formatEther(balance.toString()));
        await worker.reinvest();
        console.log(formatEther(await (await alpaca.balanceOf(alpacaFeeder.address)).toString()));
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
    context("when Mdex worker is triggered reinvest", () => {
      it("should send alpaca to AlpacaFeeder(Mdex)", async () => {
        console.log("reinvest mdex");
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        console.log(formatEther(balance.toString()));
        await mdexWorker.reinvest();
        console.log(formatEther(await (await alpaca.balanceOf(alpacaFeeder.address)).toString()));
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
    context("when PCS worker is triggered reinvest", () => {
      it("should send alpaca to AlpacaFeeder(PCS)", async () => {
        console.log("reinvest pcs");
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        console.log(formatEther(balance.toString()));
        await pcsWorker.reinvest();
        console.log(formatEther(await (await alpaca.balanceOf(alpacaFeeder.address)).toString()));
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
  });
});
