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
  MockProxyToken,
  MockProxyToken__factory,
} from "../../typechain";

chai.use(solidity);
const { expect } = chai;

describe("AlpacaFeeder", () => {
  // Constants
  const FAIR_LAUNCH_POOL_ID = 123;

  // Contact Instance
  let alpaca: BEP20;
  let proxyToken: MockProxyToken;

  let feeder: AlpacaFeeder;
  let fairLaunch: MockFairLaunch;
  let grassHouse: MockGrassHouse;

  // Accounts
  let deployer: Signer;
  let alice: Signer;

  let deployerAddress: string;
  let aliceAddress: string;

  // Contract Signer
  let alpacaAsAlice: BEP20;

  let feederAsAlice: AlpacaFeeder;

  async function fixture() {
    [deployer, alice] = await ethers.getSigners();
    [deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()]);

    // Deploy ALPACA
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    alpaca = await BEP20.deploy("ALPACA", "ALPACA");

    // Deploy PROXYTOKEN
    const MockProxyToken = (await ethers.getContractFactory("MockProxyToken", deployer)) as MockProxyToken__factory;
    const mockProxyToken = (await upgrades.deployProxy(MockProxyToken, ["PROXYTOKEN", "PROXYTOKEN"])) as MockProxyToken;
    proxyToken = await mockProxyToken.deployed();

    // Deploy GrassHouse
    const MockFairLaunch = (await ethers.getContractFactory("MockFairLaunch", deployer)) as MockFairLaunch__factory;
    fairLaunch = await MockFairLaunch.deploy(alpaca.address, proxyToken.address);

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await MockGrassHouse.deploy(alpaca.address);

    // Deploy feeder
    const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
    const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
      alpaca.address,
      proxyToken.address,
      fairLaunch.address,
      FAIR_LAUNCH_POOL_ID,
      grassHouse.address,
    ])) as AlpacaFeeder;
    feeder = await alpacaFeeder.deployed();

    await proxyToken.setOkHolders([alpacaFeeder.address, fairLaunch.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await alpaca.mint(aliceAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    alpacaAsAlice = BEP20__factory.connect(alpaca.address, alice);
    feederAsAlice = AlpacaFeeder__factory.connect(feeder.address, alice);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialize", () => {
    it("should initialized correctly", async () => {
      expect(await feeder.owner()).to.be.eq(deployerAddress);
      expect(await feeder.fairLaunch()).to.be.eq(fairLaunch.address);
      expect(await feeder.grassHouse()).to.be.eq(grassHouse.address);
      expect(await feeder.proxyToken()).to.be.eq(proxyToken.address);
    });
  });

  describe("#fairLaunchDeposit", async () => {
    it("should able to deposit 1 proxy token to fairlaunch", async () => {
      await expect(feeder.fairLaunchDeposit()).to.be.emit(feeder, "LogFairLaunchDeposit");
      expect(await proxyToken.balanceOf(fairLaunch.address)).to.be.eq(ethers.utils.parseEther("1"));
    });

    context("when already deposit proxy token in fair launch", () => {
      it("should revert", async () => {
        await expect(feeder.fairLaunchDeposit()).to.be.emit(feeder, "LogFairLaunchDeposit");
        expect(await proxyToken.balanceOf(fairLaunch.address)).to.be.eq(ethers.utils.parseEther("1"));
        await expect(feeder.fairLaunchDeposit()).to.be.revertedWith("already deposit");
      });
    });

    context("when other address try call fairLaunchDeposit", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.fairLaunchDeposit()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#fairLaunchWithdraw", async () => {
    it("should able to withdraw 1 proxy token from fairlaunch, and burn", async () => {
      await feeder.fairLaunchDeposit();
      await expect(feeder.fairLaunchWithdraw()).to.be.emit(feeder, "LogFairLaunchWithdraw");
      expect(await proxyToken.balanceOf(fairLaunch.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await proxyToken.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
    });

    context("when other address try call fairLaunchWithdraw", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.fairLaunchWithdraw()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#fairLaunchHarvest", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(fairLaunch.address, ethers.utils.parseEther("10"));
      await feeder.fairLaunchHarvest();
      expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("10"));
    });
  });

  describe("#feedGrassHouse", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(fairLaunch.address, ethers.utils.parseEther("10"));
      await alpacaAsAlice.transfer(feeder.address, ethers.utils.parseEther("20"));
      expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("20"));
      await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
      expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await alpaca.balanceOf(grassHouse.address)).to.be.eq(ethers.utils.parseEther("30"));
    });

    context("revert on harvest", () => {
      it("should continue feed", async () => {
        await alpacaAsAlice.transfer(feeder.address, ethers.utils.parseEther("20"));
        expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("20"));
        await expect(feeder.feedGrassHouse()).to.be.emit(feeder, "LogFeedGrassHouse");
        expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
        expect(await alpaca.balanceOf(grassHouse.address)).to.be.eq(ethers.utils.parseEther("20"));
      });
    });
  });
});
