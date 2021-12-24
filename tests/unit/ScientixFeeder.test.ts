import { ethers, waffle, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
  MockGrassHouse,
  MockGrassHouse__factory,
  ScientixFeeder,
  ScientixFeeder__factory,
  MockStakingPool,
  MockStakingPool__factory,
  MockProxyToken,
  MockProxyToken__factory,
} from "../../typechain";

chai.use(solidity);
const { expect } = chai;

describe("ScientixFeeder", () => {
  // Constants
  const FAIR_LAUNCH_POOL_ID = 0;

  // Contact Instance
  let alpaca: BEP20;
  let proxyToken: MockProxyToken;

  let feeder: ScientixFeeder;
  let stakingPool: MockStakingPool;
  let grassHouse: MockGrassHouse;

  // Accounts
  let deployer: Signer;
  let alice: Signer;

  let deployerAddress: string;
  let aliceAddress: string;

  // Contract Signer
  let alpacaAsAlice: BEP20;

  let feederAsAlice: ScientixFeeder;

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
    const MockStakingPool = (await ethers.getContractFactory("MockStakingPool", deployer)) as MockStakingPool__factory;
    stakingPool = await MockStakingPool.deploy(alpaca.address, proxyToken.address);

    stakingPool.createPool(proxyToken.address);

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await MockGrassHouse.deploy(alpaca.address);

    // Deploy feeder
    const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
    const scientixFeeder = (await upgrades.deployProxy(ScientixFeeder, [
      alpaca.address,
      proxyToken.address,
      stakingPool.address,
      FAIR_LAUNCH_POOL_ID,
      grassHouse.address,
    ])) as ScientixFeeder;
    feeder = await scientixFeeder.deployed();

    await proxyToken.setOkHolders([scientixFeeder.address, stakingPool.address], true);
    await proxyToken.transferOwnership(scientixFeeder.address);

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await alpaca.mint(aliceAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    alpacaAsAlice = BEP20__factory.connect(alpaca.address, alice);
    feederAsAlice = ScientixFeeder__factory.connect(feeder.address, alice);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  context("#initialize", () => {
    describe("if initialized correctly", async () => {
      it("should work", async () => {
        expect(await feeder.owner()).to.be.eq(deployerAddress);
        expect(await feeder.stakingPool()).to.be.eq(stakingPool.address);
        expect(await feeder.grassHouse()).to.be.eq(grassHouse.address);
        expect(await feeder.proxyToken()).to.be.eq(proxyToken.address);
      });
    });
    describe("if stakingPool's pool id has not been set", async () => {
      it("should revert", async () => {
        const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
        await expect(upgrades.deployProxy(ScientixFeeder, [
          alpaca.address,
          proxyToken.address,
          stakingPool.address,
          1,
          grassHouse.address,
        ])).to.be.revertedWith("!same stakeToken");
      });
    });

    describe("if stakingPool's pool stakeToken did not match ", async () => {
      it("should revert", async () => {
        const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
        await expect(upgrades.deployProxy(ScientixFeeder, [
          alpaca.address,
          proxyToken.address,
          stakingPool.address,
          1,
          grassHouse.address,
        ])).to.be.revertedWith("!same stakeToken");
      });
    });

    describe("if grasshouse's reward token did not match ", async () => {
      it("should revert", async () => {
        const ScientixFeeder = (await ethers.getContractFactory("ScientixFeeder", deployer)) as ScientixFeeder__factory;
        await expect(upgrades.deployProxy(ScientixFeeder, [
          proxyToken.address,
          proxyToken.address,
          stakingPool.address,
          FAIR_LAUNCH_POOL_ID,
          grassHouse.address,
        ])).to.be.revertedWith("!same rewardToken");
      });
    });
  });

  describe("#stakingPoolDeposit", async () => {
    it("should able to deposit 1 proxy token to stakingPool", async () => {
      await expect(feeder.stakingPoolDeposit()).to.be.emit(feeder, "LogStakingPoolDeposit");
      expect(await proxyToken.balanceOf(stakingPool.address)).to.be.eq(ethers.utils.parseEther("1"));
    });

    context("when already deposit proxy token in fair launch", () => {
      it("should revert", async () => {
        await expect(feeder.stakingPoolDeposit()).to.be.emit(feeder, "LogStakingPoolDeposit");
        expect(await proxyToken.balanceOf(stakingPool.address)).to.be.eq(ethers.utils.parseEther("1"));
        await expect(feeder.stakingPoolDeposit()).to.be.revertedWith("already deposit");
      });
    });

    context("when other address try call stakingPoolDeposit", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.stakingPoolDeposit()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#stakingPoolWithdraw", async () => {
    it("should able to withdraw 1 proxy token from stakingPool, and burn", async () => {
      await feeder.stakingPoolDeposit();
      await expect(feeder.stakingPoolWithdraw()).to.be.emit(feeder, "LogStakingPoolWithdraw");
      expect(await proxyToken.balanceOf(stakingPool.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await proxyToken.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
    });

    context("when other address try call stakingPoolWithdraw", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.stakingPoolWithdraw()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#stakingPoolClaim", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(stakingPool.address, ethers.utils.parseEther("10"));
      await feeder.stakingPoolClaim();
      expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("10"));
    });
  });

  describe("#feedGrassHouse", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(stakingPool.address, ethers.utils.parseEther("10"));
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
