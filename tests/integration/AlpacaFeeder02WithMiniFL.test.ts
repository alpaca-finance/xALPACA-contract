import { zeroAddress } from "ethereumjs-util";
import { ethers, waffle, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ProxyToken, GrassHouse, AlpacaFeeder02, XALPACA, BEP20, BEP20__factory } from "../../typechain";
import { Timelock__factory, MiniFL__factory, MiniFL } from "@alpaca-finance/alpaca-contract/typechain";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TimelockHelper } from "../helpers/timelock";
import * as addresses from "../constants/ftm/addresses";
import * as deployHelper from "../helpers/deploy";
import * as timeHelper from "../helpers/time";

chai.use(solidity);
const { expect } = chai;

describe("AlpacaFeeder02 - Integration test", () => {
  let deployer: SignerWithAddress;

  // setting
  let poolId: BigNumber;

  let alpaca: BEP20;

  // contracts
  let xalpaca: XALPACA;
  let miniFL: MiniFL;
  // let timelockHelper: TimelockHelperFTM;
  let alpacaFeeder: AlpacaFeeder02;
  let proxyToken: ProxyToken;
  let grassHouse: GrassHouse;

  async function fixture() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.DEPLOYER],
    });
    deployer = await ethers.getSigner(addresses.DEPLOYER);
    alpaca = await BEP20__factory.connect(addresses.ALPACA, deployer);
    // const timelock = await Timelock__factory.connect(addresses.TIME_LOCK, deployer);
    miniFL = await MiniFL__factory.connect(addresses.FAIR_LAUNCH, deployer);
    // timelockHelper = new TimelockHelperFTM(timelock, miniFL);
    xalpaca = await deployHelper.deployXAlpacaFTM(deployer);
    proxyToken = await deployHelper.deployProxyToken(deployer);
    grassHouse = await deployHelper.deployGrasshouseFTM(deployer, xalpaca.address);
    poolId = await miniFL.poolLength();
    // add new fairlaunch pool
    // await timelockHelper.addMiniFLPool(100, proxyToken.address, false);
    await miniFL.addPool(100, proxyToken.address, zeroAddress(), false, false);
    alpacaFeeder = await deployHelper.deployAlpacaFeeder02(deployer, proxyToken.address, poolId, grassHouse.address);
    await proxyToken.setOkHolders([alpacaFeeder.address, miniFL.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("AlpacaFeeder02", () => {
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
            await alpacaFeeder.miniFLDeposit();
            await timeHelper.increaseTimestamp(timeHelper.duration.days(BigNumber.from(7)));
            await expect(alpacaFeeder.feedGrassHouse()).to.be.emit(alpacaFeeder, "LogFeedGrassHouse");
            expect(await alpaca.balanceOf(grassHouse.address)).to.be.gt(alpacaBalance);
          });
        });
      });
    });
  });
});
