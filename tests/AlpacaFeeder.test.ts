import { ethers, waffle, upgrades } from "hardhat";
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
  MockFairLaunch,
  MockFairLaunch__factory,
} from "../typechain";
// import * as timeHelpers from "./helpers/time";
// import * as assertHelpers from "./helpers/assert";
// import * as mathHelpers from "./helpers/math";

chai.use(solidity);
const { expect } = chai;

describe("AlpacaFeeder", () => {
  // Constants
  const fairLuancePoolId = 123;

  // Contact Instance
  let ALPACA: BEP20;
  let DEBTTOKEN: BEP20;

  let mockFairLaunch: MockFairLaunch;
  let mockGrassHouse: MockGrassHouse;
  let feeder: AlpacaFeeder;

  // Accounts
  let deployer: Signer;
  let alice: Signer;
  let bob: Signer;
  let eve: Signer;

  let deployerAddress: string;
  let aliceAddress: string;
  let bobAddress: string;
  let eveAddress: string;

  // Contract Signer
  let ALPACAasAlice: BEP20;
  let ALPACAasBob: BEP20;
  let ALPACAasEve: BEP20;

  async function fixture() {
    [deployer, alice, bob, eve] = await ethers.getSigners();
    [deployerAddress, aliceAddress, bobAddress, eveAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      eve.getAddress(),
    ]);

    // Deploy ALPACA
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    ALPACA = await BEP20.deploy("ALPACA", "ALPACA");

    // Deploy GrassHouse
    const MOCKFAIRLAUNCH = (await ethers.getContractFactory("MockFairLaunch", deployer)) as MockFairLaunch__factory;
    mockFairLaunch = await MOCKFAIRLAUNCH.deploy(ALPACA.address);

    // Deploy DEBTTOKEN
    DEBTTOKEN = await BEP20.deploy("DEBTTOKEN", "DEBTTOKEN");

    // Deploy GrassHouse
    const MOCKGRASSHOUSE = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    mockGrassHouse = await MOCKGRASSHOUSE.deploy(ALPACA.address);

    // Deploy feeder
    const ALCAPAFEEDER = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
    const alpacaFeeder = (await upgrades.deployProxy(ALCAPAFEEDER, [
      ALPACA.address,
      DEBTTOKEN.address,
      mockFairLaunch.address,
      fairLuancePoolId,
      mockGrassHouse.address,
    ])) as AlpacaFeeder;
    feeder = await alpacaFeeder.deployed();

    // MINT
    await ALPACA.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(aliceAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(bobAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(eveAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    ALPACAasAlice = BEP20__factory.connect(ALPACA.address, alice);
    ALPACAasBob = BEP20__factory.connect(ALPACA.address, bob);
    ALPACAasEve = BEP20__factory.connect(ALPACA.address, eve);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialized", async () => {
    it("should initialized correctly", async () => {
      expect(await feeder.fairLaunch()).to.be.eq(mockFairLaunch.address);
      expect(await feeder.grassHouse()).to.be.eq(mockGrassHouse.address);
    });
  });

  describe("#feedGrassHouse", async () => {
    it("should work correctly", async () => {
      await ALPACAasAlice.transfer(mockFairLaunch.address, ethers.utils.parseEther("10"));
      await ALPACAasAlice.transfer(feeder.address, ethers.utils.parseEther("20"));
      expect(await ALPACA.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("20"));
      await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
      expect(await ALPACA.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await ALPACA.balanceOf(mockGrassHouse.address)).to.be.eq(ethers.utils.parseEther("30"));
    });

    context("revert on harvest", () => {
      it("should continue feed", async () => {
        await ALPACAasAlice.transfer(feeder.address, ethers.utils.parseEther("20"));
        expect(await ALPACA.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("20"));
        await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
        expect(await ALPACA.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
        expect(await ALPACA.balanceOf(mockGrassHouse.address)).to.be.eq(ethers.utils.parseEther("20"));
      });
    });
  });

  describe("#fairLaunchHarvest", async () => {
    it("should work correctly", async () => {
      await ALPACAasAlice.transfer(mockFairLaunch.address, ethers.utils.parseEther("10"));
      await feeder.fairLaunchHarvest();
      expect(await ALPACA.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("10"));
    });
  });
});
