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
import {
  ALPACA,
  DEPLOYER,
  FAIR_LAUNCH,
  SHIELD,
  TIME_LOCK,
  CAKEMAXI_WORKER,
  MDEX_WORKER,
  PCS_WORKER,
  CAKE,
  WBNB,
  MDEX,
  BUSD,
} from "../constants/addresses";
import * as deployHelper from "../helpers/deploy";

chai.use(solidity);
const { expect } = chai;

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

    // Deploy xAlpaca
    xalpaca = await deployHelper.deployXAlpaca(deployer);

    // Deploy PROXY Token
    proxyToken = await deployHelper.deployProxyToken(deployer);

    // Deploy Grasshouse
    grassHouse = await deployHelper.deployGrasshouse(deployer, xalpaca.address);

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

    // Deploy AlpacaFeeder
    alpacaFeeder = await deployHelper.deployAlpacaFeeder(deployer, proxyToken.address, poolId, grassHouse.address);
    await proxyToken.setOkHolders([alpacaFeeder.address, fairlaunch.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);

    const executeTime2 = (await timeHelpers.latestTimestamp())
      .add(timeHelpers.duration.days(BigNumber.from(2)))
      .toNumber();

    // Connect workers by deployer
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
    context("when CakeMaxi worker trigger reinvest", () => {
      it("should send alpaca to AlpacaFeeder(CakeMaxi)", async () => {
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        expect(balance).to.be.eq(0);
        await worker.reinvest();
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
    context("when Mdex worker trigger reinvest", () => {
      it("should send alpaca to AlpacaFeeder(Mdex)", async () => {
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        expect(balance).to.be.eq(0);
        await mdexWorker.reinvest();
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
    context("when PCS worker trigger reinvest", () => {
      it("should send alpaca to AlpacaFeeder(PCS)", async () => {
        const balance = await alpaca.balanceOf(alpacaFeeder.address);
        expect(balance).to.be.eq(0);
        await pcsWorker.reinvest();
        expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.gt(balance);
      });
    });
  });
});
