import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades, waffle } from "hardhat";
import { BigNumber, Signer } from "ethers";
import {
  AlpacaFeeder,
  TaxFeeder,
  BEP20,
  BEP20__factory,
  MockProxyToken,
  MockFairLaunch,
  MockGrassHouse,
  TaxFeeder__factory,
  AlpacaFeeder__factory,
  MockFairLaunch__factory,
  MockGrassHouse__factory,
  MockProxyToken__factory,
  MockAnySwapV4Router__factory,
  MockAnySwapV4Router,
} from "../../typechain";

chai.use(solidity);
const { expect } = chai;

describe("TaxFeeder", () => {
  // Constants
  const FAIR_LAUNCH_POOL_ID = 0;
  const MAXIMUM_TAX_BPS = 4000;
  const TAX_COLLECTOR_CHAIN_ID = 97;

  // Contract Instance
  let alpaca: BEP20;
  let proxyToken: MockProxyToken;

  let alpacaFeeder: AlpacaFeeder;
  let fairLaunch: MockFairLaunch;
  let grassHouse: MockGrassHouse;
  let taxFeeder: TaxFeeder;

  let mockAnySwapRouter: MockAnySwapV4Router;

  // Accounts
  let deployer: Signer;
  let alice: Signer;

  let deployerAddress: string;
  let aliceAddress: string;

  // Contract Signer
  let alpacaAsAlice: BEP20;

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

    await fairLaunch.addPool(proxyToken.address);

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await await MockGrassHouse.deploy(alpaca.address);

    // Deploy feeder
    const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
    alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
      alpaca.address,
      proxyToken.address,
      fairLaunch.address,
      FAIR_LAUNCH_POOL_ID,
      grassHouse.address,
    ])) as AlpacaFeeder;
    alpacaFeeder = await alpacaFeeder.deployed();

    await proxyToken.setOkHolders([alpacaFeeder.address, fairLaunch.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await alpaca.mint(aliceAddress, ethers.utils.parseEther("8888888"));

    // Deploy feeder
    const MockAnySwapV4Router = (await ethers.getContractFactory(
      "MockAnySwapV4Router",
      deployer
    )) as MockAnySwapV4Router__factory;
    mockAnySwapRouter = await MockAnySwapV4Router.deploy();

    const TaxFeeder = (await ethers.getContractFactory("TaxFeeder", deployer)) as TaxFeeder__factory;
    taxFeeder = (await upgrades.deployProxy(TaxFeeder, [
      alpaca.address,
      alpacaFeeder.address,
      mockAnySwapRouter.address,
      mockAnySwapRouter.address,
      TAX_COLLECTOR_CHAIN_ID,
      MAXIMUM_TAX_BPS,
    ])) as TaxFeeder;
    await taxFeeder.deployed();

    alpacaAsAlice = BEP20__factory.connect(alpaca.address, alice);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialize", async () => {
    it("should revert if set tax bps exceed", async () => {
      const TaxFeeder = (await ethers.getContractFactory("TaxFeeder", deployer)) as TaxFeeder__factory;
      await expect(
        upgrades.deployProxy(TaxFeeder, [
          alpaca.address,
          alpacaFeeder.address,
          mockAnySwapRouter.address,
          mockAnySwapRouter.address,
          TAX_COLLECTOR_CHAIN_ID,
          10000,
        ])
      ).to.be.revertedWith("TaxFeeder_TooMuchTaxBps(10000)");
    });

    context("when deployed", async () => {
      it("should correct data on tax feeder", async () => {
        expect(await taxFeeder.owner()).to.be.eq(deployerAddress);
        expect(await taxFeeder.alpacaToken()).to.be.eq(alpaca.address);
        expect(await taxFeeder.alpacaFeeder()).to.be.eq(alpacaFeeder.address);
        expect(await taxFeeder.anySwapRouter()).to.be.eq(mockAnySwapRouter.address);
        expect(await taxFeeder.taxCollector()).to.be.eq(mockAnySwapRouter.address);
        expect(await taxFeeder.taxCollectorChainId()).to.be.eq(BigNumber.from(TAX_COLLECTOR_CHAIN_ID));
        expect(await taxFeeder.taxBps()).to.be.eq(BigNumber.from(MAXIMUM_TAX_BPS));
      });
    });
  });

  describe("#setTaxBps", async () => {
    context("when set tax bps correct", async () => {
      it("should chagned same what we set", async () => {
        const taxBps = BigNumber.from(3000);
        await taxFeeder.setTaxBps(taxBps);
        expect(await taxFeeder.taxBps()).to.be.eq(taxBps);
      });
    });

    context("when set tax bps exceed", async () => {
      it("should revert", async () => {
        await expect(taxFeeder.setTaxBps(BigNumber.from(1000000))).to.be.revertedWith(
          "TaxFeeder_TooMuchTaxBps(1000000)"
        );
      });
    });
  });

  describe("#feed", async () => {
    context("when anyont call feed", async () => {
      it("should transfer alpaca token to AlpacaFeeder and Bridge to bsc chain", async () => {
        // assume reward send to tax feeder 10.000000000000000000
        await alpaca.transfer(taxFeeder.address, ethers.utils.parseEther("10"));
        // calculation
        // tax percentage = 40%
        // tax amount = 10.000000000000000000 * 0.4 = 4.000000000000000000
        // feed amount = 10.000000000000000000 - 4.000000000000000000 = 6.000000000000000000
        const expectedFeedAmount = ethers.utils.parseEther("6.000000000000000000");
        const expectedFeedTaxAmount = ethers.utils.parseEther("4.000000000000000000");
        const alpacaTokenBefore = await alpaca.balanceOf(alpacaFeeder.address);
        await expect(taxFeeder.feed())
          .to.be.emit(taxFeeder, "Feed")
          .withArgs(
            alpacaFeeder.address,
            expectedFeedAmount,
            mockAnySwapRouter.address,
            BigNumber.from(TAX_COLLECTOR_CHAIN_ID),
            expectedFeedTaxAmount
          );
        const alpacaTokenAfter = await alpaca.balanceOf(alpacaFeeder.address);
        expect(alpacaTokenAfter.sub(alpacaTokenBefore)).to.be.eq(expectedFeedAmount);

        // expect tax feeder feed all alpaca
        expect(await alpaca.balanceOf(taxFeeder.address)).to.be.eq(BigNumber.from(0));
      });
    });
  });
});
