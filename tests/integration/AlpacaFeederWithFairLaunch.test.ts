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
} from "@alpaca-finance/alpaca-contract/typechain";
import * as timeHelpers from "../helpers/time";
import { BigNumber, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
const { expect } = chai;

// contract's addresses
const TIME_LOCK = "0x2D5408f2287BF9F9B05404794459a846651D0a59";
const FAIR_LAUNCH = "0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F";
const DEPLOYER = "0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51";
const SHIELD = "0x1963f84395c8cf464e5483de7f2f434c3f1b4656";
const ALPACA = "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F";

describe("AlpacaFeeder - Integration test", () => {
  let deployer: SignerWithAddress;
  let bot: Signer;
  let lyf: Signer;

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
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("AlpacaFeeder", () => {
    context("when try feed alpaca to grasshouse", () => {
      context("when feeder not staking alpaca on fairlaunch", () => {
        context("when feeder has 10 alpaca", () => {
          it("grasshouse should receive alpaca equal with alpaca balance on feeder", async () => {
            /**
             * 1. transfer 10 alpaca to feeder
             * 2. feed to grasshouse
             * 3. check grasshouse balance should be 10
             */
            await alpaca.transfer(alpacaFeeder.address, ethers.utils.parseEther("10"));
            const alpacaBalance = await alpaca.balanceOf(alpacaFeeder.address);
            await expect(alpacaFeeder.feedGrassHouse()).to.be.emit(alpacaFeeder, "LogFeedGrassHouse");
            expect(await alpaca.balanceOf(grassHouse.address)).to.be.eq(alpacaBalance);
          });
        });

        context("when feeder balance is zero", () => {
          it("shoud not revert and grasshouse will not received any alpaca", async () => {
            /**
             * 1. feed to grasshouse
             * 2. check grasshouse balance should be 0
             * NOTE: shoud not revert
             */
            const alpacaBalance = await alpaca.balanceOf(alpacaFeeder.address);
            await expect(alpacaFeeder.feedGrassHouse()).to.be.emit(alpacaFeeder, "LogFeedGrassHouse");
            expect(await alpaca.balanceOf(grassHouse.address)).to.be.eq(alpacaBalance);
          });
        });
      });

      context("when feeder staking alpaca on fairlaunch", () => {
        context("when feeder has 10 alpaca", () => {
          it("grasshouse should receive alpaca greater than alpaca balance on feeder", async () => {
            /**
             * 1. transfer 10 alpaca to feeder
             * 2. deposit proxytoken to fairlaunch
             * 3. advance block for 1 week
             * 4. feed to grasshouse
             * 5. check grasshouse balance should be 10
             */
            await alpaca.transfer(alpacaFeeder.address, ethers.utils.parseEther("10"));
            const alpacaBalance = await alpaca.balanceOf(alpacaFeeder.address);
            await alpacaFeeder.fairLaunchDeposit();
            await timeHelpers.increaseTimestamp(timeHelpers.duration.days(BigNumber.from(7)));
            await expect(alpacaFeeder.feedGrassHouse()).to.be.emit(alpacaFeeder, "LogFeedGrassHouse");
            expect(await alpaca.balanceOf(grassHouse.address)).to.be.gt(alpacaBalance);
          });
        });
      });
    });
  });
});
