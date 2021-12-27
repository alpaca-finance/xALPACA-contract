import { ethers, waffle, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  ProxyToken,
  ProxyToken__factory,
  GrassHouse,
  ScientixFeeder,
  XALPACA,
  BEP20,
  BEP20__factory,
  XALPACA__factory,
  GrassHouse__factory,
  ScientixFeeder__factory,
} from "../../typechain";

import { BigNumber, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as addresses from "../constants/addresses";
import * as timeHelper from "../helpers/time";

chai.use(solidity);
const { expect } = chai;

describe("ScientixFeeder - Integration test", () => {
  let deployer: SignerWithAddress;

  // setting
  let poolId: BigNumber;

  let scix: BEP20;

  // contracts
  let xalpaca: XALPACA;
  let feeder: ScientixFeeder;
  let proxyToken: ProxyToken;
  let grassHouse: GrassHouse;

  async function fixture() {
    const scixStakingPoolAddress = "0x68145F3319F819b8E01Dfa3c094fa8205E9EfB9a";
    const fdSCIXAddress = "0xc04096B8D0c4Fd0fd7a8667e813E630935aaff05";
    const xAlpacaAddress = "0xB7d85Ab25b9D478961face285fa3D8AAecAd24a9";
    const scixAddress = "0x2CFC48CdFea0678137854F010b5390c5144C0Aa5";

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.DEPLOYER],
    });
    deployer = await ethers.getSigner(addresses.DEPLOYER);

    scix = await BEP20__factory.connect(scixAddress, deployer);
    xalpaca = await XALPACA__factory.connect(xAlpacaAddress, deployer);
    proxyToken = await ProxyToken__factory.connect(fdSCIXAddress, deployer);
    
    // Deploy GrassHouse
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    const ScixGrassHouse = (await upgrades.deployProxy(GrassHouse, [
      xAlpacaAddress,
      await timeHelper.latestTimestamp(),
      scixAddress,
      addresses.DEPLOYER,
    ])) as GrassHouse;
    grassHouse = await ScixGrassHouse.deployed();

    // Deploy Scientix Feeder
    const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
    const scientixFeeder = (await upgrades.deployProxy(ScientixFeeder, [
      scixAddress,
      fdSCIXAddress,
      scixStakingPoolAddress,
      8,
      grassHouse.address,
    ])) as ScientixFeeder;
    feeder = await scientixFeeder.deployed();

    await proxyToken.setOkHolders([scientixFeeder.address, scixStakingPoolAddress], true);
    await proxyToken.transferOwnership(scientixFeeder.address);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("ScientixFeeder", () => {
    context("when try feed scix to grasshouse", () => {
      context("when feeder not staking scix on fairlaunch", () => {
        context("when feeder balance is zero", () => {
          it("shoud not revert and grasshouse will not received any scix", async () => {
            /**
             * 1. feed to grasshouse
             * 2. check grasshouse balance should be 0
             * NOTE: shoud not revert
             */
            const scixBalance = await scix.balanceOf(feeder.address);
            await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
            expect(await scix.balanceOf(grassHouse.address)).to.be.eq(scixBalance);
          });
        });
      });

      context("when feeder staking scix on fairlaunch", () => {
        context("when feeder has 10 scix", () => {
          it("grasshouse should receive scix greater than scix balance on feeder", async () => {
            /**
             * 1. deposit proxytoken to fairlaunch
             * 2. advance block for 1 week
             * 3. feed to grasshouse
             * 4. check grasshouse balance should be 
             */
            const scixBalance = await scix.balanceOf(feeder.address);
            await feeder.stakingPoolDeposit();
            await timeHelper.increaseTimestamp(timeHelper.duration.days(BigNumber.from(7)));
            await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
            expect(await scix.balanceOf(grassHouse.address)).to.be.gt(scixBalance);
          });
        });
      });
    });
  });
});
