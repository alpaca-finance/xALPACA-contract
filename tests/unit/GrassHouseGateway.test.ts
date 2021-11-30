import { ethers, waffle, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
  MockGrassHouse,
  MockGrassHouse__factory,
  MockProxyToken,
  MockProxyToken__factory,
  GrassHouseGateway,
  GrassHouseGateway__factory
} from "../../typechain";

chai.use(solidity);
const { expect } = chai;

describe("AlpacaFeeder", () => {
  // Constants
  const FAIR_LAUNCH_POOL_ID = 123;

  // Contact Instance
  let alpaca: BEP20;
  let proxyToken: MockProxyToken;

  let grassHouse: MockGrassHouse;

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

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await MockGrassHouse.deploy(alpaca.address);

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await alpaca.mint(aliceAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    alpacaAsAlice = BEP20__factory.connect(alpaca.address, alice);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialize", () => {
    it("should initialized correctly", async () => {
    });
  });
});
