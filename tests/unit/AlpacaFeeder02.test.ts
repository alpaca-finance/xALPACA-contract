import { ethers, waffle, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
  MockGrassHouse,
  MockGrassHouse__factory,
  AlpacaFeeder02,
  AlpacaFeeder02__factory,
  MockMiniFL,
  MockMiniFL__factory,
  MockProxyToken,
  MockProxyToken__factory,
} from "../../typechain";

chai.use(solidity);
const { expect } = chai;

describe("AlpacaFeeder", () => {
  // Constants
  const FAIR_LAUNCH_POOL_ID = 0;

  // Contact Instance
  let alpaca: BEP20;
  let proxyToken: MockProxyToken;

  let feeder: AlpacaFeeder02;
  let miniFL: MockMiniFL;
  let grassHouse: MockGrassHouse;
  let newGrassHouse: MockGrassHouse;

  // Accounts
  let deployer: Signer;
  let alice: Signer;

  let deployerAddress: string;
  let aliceAddress: string;

  // Contract Signer
  let alpacaAsAlice: BEP20;

  let feederAsAlice: AlpacaFeeder02;

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

    // Deploy MiniFL
    const MockMiniFL = (await ethers.getContractFactory("MockMiniFL", deployer)) as MockMiniFL__factory;
    miniFL = await MockMiniFL.deploy(alpaca.address, proxyToken.address);

    await miniFL.addPool(proxyToken.address);

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await MockGrassHouse.deploy(alpaca.address);
    newGrassHouse = await MockGrassHouse.deploy(alpaca.address);

    // Deploy feeder
    const AlpacaFeeder02 = (await ethers.getContractFactory("AlpacaFeeder02", deployer)) as AlpacaFeeder02__factory;
    const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder02, [
      alpaca.address,
      proxyToken.address,
      miniFL.address,
      FAIR_LAUNCH_POOL_ID,
      grassHouse.address,
    ])) as AlpacaFeeder02;
    feeder = await alpacaFeeder.deployed();

    await proxyToken.setOkHolders([alpacaFeeder.address, miniFL.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await alpaca.mint(aliceAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    alpacaAsAlice = BEP20__factory.connect(alpaca.address, alice);
    feederAsAlice = AlpacaFeeder02__factory.connect(feeder.address, alice);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  context("#initialize", () => {
    describe("if initialized correctly", async () => {
      it("should work", async () => {
        expect(await feeder.owner()).to.be.eq(deployerAddress);
        expect(await feeder.miniFL()).to.be.eq(miniFL.address);
        expect(await feeder.grassHouse()).to.be.eq(grassHouse.address);
        expect(await feeder.proxyToken()).to.be.eq(proxyToken.address);
      });
    });
    describe("if miniFL's pool id has not been set", async () => {
      it("should revert", async () => {
        const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder02", deployer)) as AlpacaFeeder02__factory;
        await expect(
          upgrades.deployProxy(AlpacaFeeder, [
            alpaca.address,
            proxyToken.address,
            miniFL.address,
            1,
            grassHouse.address,
          ])
        ).to.be.revertedWith("Address: low-level delegate call failed");
      });
    });

    describe("if miniFL's pool stakeToken did not match ", async () => {
      it("should revert", async () => {
        await miniFL.addPool(grassHouse.address);
        const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder02", deployer)) as AlpacaFeeder02__factory;
        await expect(
          upgrades.deployProxy(AlpacaFeeder, [
            alpaca.address,
            proxyToken.address,
            miniFL.address,
            1,
            grassHouse.address,
          ])
        ).to.be.revertedWith("AlpacaFeeder02_InvalidToken()");
      });
    });

    describe("if grasshouse's reward token did not match ", async () => {
      it("should revert", async () => {
        const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder02", deployer)) as AlpacaFeeder02__factory;
        await expect(
          upgrades.deployProxy(AlpacaFeeder, [
            proxyToken.address,
            proxyToken.address,
            miniFL.address,
            FAIR_LAUNCH_POOL_ID,
            grassHouse.address,
          ])
        ).to.be.revertedWith("AlpacaFeeder02_InvalidRewardToken()");
      });
    });
  });

  describe("#miniFLDeposit", async () => {
    it("should able to deposit 1 proxy token to miniFL", async () => {
      await expect(feeder.miniFLDeposit()).to.be.emit(feeder, "LogMiniFLDeposit");
      expect(await proxyToken.balanceOf(miniFL.address)).to.be.eq(ethers.utils.parseEther("1"));
    });

    context("when already deposit proxy token in fair launch", () => {
      it("should revert", async () => {
        await expect(feeder.miniFLDeposit()).to.be.emit(feeder, "LogMiniFLDeposit");
        expect(await proxyToken.balanceOf(miniFL.address)).to.be.eq(ethers.utils.parseEther("1"));
        await expect(feeder.miniFLDeposit()).to.be.revertedWith("AlpacaFeeder02_Deposited()");
      });
    });

    context("when other address try call miniFLDeposit", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.miniFLDeposit()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#miniFLWithdraw", async () => {
    it("should able to withdraw 1 proxy token from miniFL, and burn", async () => {
      await feeder.miniFLDeposit();
      await expect(feeder.miniFLWithdraw()).to.be.emit(feeder, "LogMiniFLWithdraw");
      expect(await proxyToken.balanceOf(miniFL.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await proxyToken.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("0"));
    });

    context("when other address try call miniFLWithdraw", () => {
      it("should revert", async () => {
        await expect(feederAsAlice.miniFLWithdraw()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#miniFLHarvest", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(miniFL.address, ethers.utils.parseEther("10"));
      await feeder.miniFLHarvest();
      expect(await alpaca.balanceOf(feeder.address)).to.be.eq(ethers.utils.parseEther("10"));
    });
  });

  describe("#feedGrassHouse", async () => {
    it("should work correctly", async () => {
      await alpacaAsAlice.transfer(miniFL.address, ethers.utils.parseEther("10"));
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
  describe("#setGrassHouse", async () => {
    it("should work correctly", async () => {
      await expect(feeder.setGrassHouse(newGrassHouse.address)).to.be.emit(feeder, "LogSetGrassHouse");
      expect(await feeder.grassHouse()).to.be.eq(newGrassHouse.address);
    });
  });
});
