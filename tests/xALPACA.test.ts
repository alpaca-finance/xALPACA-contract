import { ethers, waffle } from "hardhat";
import { Signer, BigNumberish, utils, Wallet, BigNumber, constants } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BEP20, BEP20__factory, XALPACA, XALPACA__factory } from "../typechain";
import * as TimeHelpers from "./helpers/time";

chai.use(solidity);
const { expect } = chai;

describe("xALPACA", () => {
  const MAX_LOCK = 126144000;
  const WEEK = 604800;

  // Contact Instance
  let ALPACA: BEP20;
  let xALPACA: XALPACA;

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

  let xALPACAasAlice: XALPACA;
  let xALPACAasBob: XALPACA;
  let xALPACAasEve: XALPACA;

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
    await ALPACA.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(aliceAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(bobAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(eveAddress, ethers.utils.parseEther("8888888"));

    // Deploy xALPACA
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xALPACA = await XALPACA.deploy(ALPACA.address);

    // Assign contract signer
    ALPACAasAlice = BEP20__factory.connect(ALPACA.address, alice);
    ALPACAasBob = BEP20__factory.connect(ALPACA.address, bob);
    ALPACAasEve = BEP20__factory.connect(ALPACA.address, eve);

    xALPACAasAlice = XALPACA__factory.connect(xALPACA.address, alice);
    xALPACAasBob = XALPACA__factory.connect(xALPACA.address, bob);
    xALPACAasEve = XALPACA__factory.connect(xALPACA.address, eve);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialized", async () => {
    it("should initialized correctly", async () => {
      expect(await xALPACA.name()).to.be.eq("xALPACA");
      expect(await xALPACA.symbol()).to.be.eq("xALPACA");
      expect(await xALPACA.decimals()).to.be.eq(await ALPACA.decimals());
      expect(await xALPACA.token()).to.be.eq(ALPACA.address);
      expect(await xALPACA.MAX_LOCK()).to.be.eq(MAX_LOCK);
      expect(await xALPACA.WEEK()).to.be.eq(WEEK);

      const pointHistory0 = await xALPACA.pointHistory(0);
      expect(pointHistory0.bias).to.be.eq(0);
      expect(pointHistory0.slope).to.be.eq(0);
      expect(pointHistory0.timestamp).to.be.gt(0);
      expect(pointHistory0.blockNumber).to.be.gt(0);
    });
  });

  describe("#createLock", async () => {
    context("when user lock MAX_LOCK", async () => {
      it("should work", async () => {
        // Alice lock ALPACA for 4 years
        const latestBlockTimestamp = await TimeHelpers.latest();
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
        await xALPACAasAlice.createLock(ethers.utils.parseEther("88"), latestBlockTimestamp.add(MAX_LOCK));

        const lockedAlice = await xALPACAasAlice.locks(aliceAddress);
        expect(await ALPACA.balanceOf(xALPACA.address)).to.be.eq(ethers.utils.parseEther("88"));
        expect(await xALPACA.supply()).to.be.eq(ethers.utils.parseEther("88"));
        expect(lockedAlice.amount).to.be.eq(ethers.utils.parseEther("88"));
        expect(lockedAlice.end).to.be.eq(latestBlockTimestamp.add(MAX_LOCK).div(WEEK).mul(WEEK));
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("88"));
      });
    });
  });

  // Complex scneario based on:
  // https://github.com/curvefi/curve-dao-contracts/blob/master/tests/integration/VotingEscrow/test_votingLockup.py
  describe("#complex", async () => {
    it("should work", async () => {});
  });
});
