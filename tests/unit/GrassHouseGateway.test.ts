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

describe("GrasshouseGateway", () => {
  // Contact Instance
  let alpaca: BEP20;
  let rewardToken: BEP20;

  let grassHouse: MockGrassHouse;
  let secondGrasshouse: MockGrassHouse;
  let gateway: GrassHouseGateway;

  // Accounts
  let deployer: Signer;
  let alice: Signer;

  let deployerAddress: string;
  let aliceAddress: string;

  // Contract Signer
  let alpacaAsDeployer: BEP20;
  let rewardTokenAsDeployer: BEP20;

  let gatewayAsAlice: GrassHouseGateway;

  async function fixture() {
    [deployer, alice] = await ethers.getSigners();
    [deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()]);

    // Deploy ALPACA
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    alpaca = await BEP20.deploy("ALPACA", "ALPACA");
    rewardToken = await BEP20.deploy("RTOKEN", "RTOKEN");

    // Deploy GrassHouse
    const MockGrassHouse = (await ethers.getContractFactory("MockGrassHouse", deployer)) as MockGrassHouse__factory;
    grassHouse = await MockGrassHouse.deploy(alpaca.address);
    secondGrasshouse = await MockGrassHouse.deploy(rewardToken.address);

    // Deploy Gateway
    const Gateway = (await ethers.getContractFactory("GrassHouseGateway", deployer)) as GrassHouseGateway__factory;
    gateway = await Gateway.deploy();

    // MINT
    await alpaca.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await rewardToken.mint(deployerAddress, ethers.utils.parseEther("8888888"));

    // Assign contract signer
    alpacaAsDeployer = BEP20__factory.connect(alpaca.address, deployer);
    rewardTokenAsDeployer = BEP20__factory.connect(rewardToken.address, deployer);

    gatewayAsAlice = GrassHouseGateway__factory.connect(gateway.address, alice);

    // Set Mock Grasshouse to release 10 alpaca per claim
    grassHouse.setRewardPerClaim(ethers.utils.parseEther("10"));
    secondGrasshouse.setRewardPerClaim(ethers.utils.parseEther("20"));

    // Transfer tokens to Grasshouse
    alpacaAsDeployer.transfer(grassHouse.address, ethers.utils.parseEther("100"));
    rewardTokenAsDeployer.transfer(secondGrasshouse.address, ethers.utils.parseEther("100"));
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#Claim", () => {
    context("if all addresses are grasshouses", async () => {
      it("should be able to claim through gateway", async () => {
        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(0);

        await gatewayAsAlice.claimMultiple([grassHouse.address, secondGrasshouse.address], await alice.getAddress());

        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(ethers.utils.parseEther("10"));
        expect(await rewardToken.balanceOf(await alice.getAddress())).to.be.eq(ethers.utils.parseEther("20"));
      });
    })

    context("if some addresses are not grasshouses", async () => {
      it("should revert", async () => {
        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(0);

        await expect(gatewayAsAlice.claimMultiple([grassHouse.address, alpaca.address], await alice.getAddress())).to.be.reverted;

        
        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(0);
        expect(await rewardToken.balanceOf(await alice.getAddress())).to.be.eq(0);
      });
    })

    context("if no addresses are provided", async () => {
      it("should be ok", async () => {
        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(0);

        await expect(gatewayAsAlice.claimMultiple([], await alice.getAddress())).to.not.be.reverted;
        
        expect(await alpaca.balanceOf(await alice.getAddress())).to.be.eq(0);
        expect(await rewardToken.balanceOf(await alice.getAddress())).to.be.eq(0);
      });
    })
  });
});
