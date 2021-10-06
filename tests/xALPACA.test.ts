import { ethers, waffle } from "hardhat";
import { Signer, BigNumberish, utils, Wallet, BigNumber, constants } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BEP20, BEP20__factory, XALPACA, XALPACA__factory } from "../typechain";
import * as timeHelpers from "./helpers/time";
import * as assertHelpers from "./helpers/assert";
import * as mathHelpers from "./helpers/math";

chai.use(solidity);
const { expect } = chai;

describe("xALPACA", () => {
  const TOLERANCE = "0.04"; // 0.04%
  const HOUR = ethers.BigNumber.from(3600);
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);
  const MAX_LOCK = 126144000;

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
        const latestBlockTimestamp = await timeHelpers.latestTimestamp();
        const latestBlockNumber = await timeHelpers.latestBlockNumber();

        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
        await xALPACAasAlice.createLock(ethers.utils.parseEther("1000"), latestBlockTimestamp.add(MAX_LOCK));

        console.log((await xALPACA.balanceOfAt(aliceAddress, latestBlockNumber.add(2))).toString());

        const lockedAlice = await xALPACAasAlice.locks(aliceAddress);
        expect(await ALPACA.balanceOf(xALPACA.address)).to.be.eq(ethers.utils.parseEther("1000"));
        expect(await xALPACA.supply()).to.be.eq(ethers.utils.parseEther("1000"));
        expect(lockedAlice.amount).to.be.eq(ethers.utils.parseEther("1000"));
        expect(lockedAlice.end).to.be.eq(latestBlockTimestamp.add(MAX_LOCK).div(WEEK).mul(WEEK));

        await timeHelpers.increaseTimestamp(timeHelpers.duration.weeks(BigNumber.from("2")));
        await xALPACA.checkpoint();
      });
    });
  });

  // Complex scneario based on:
  // https://github.com/curvefi/curve-dao-contracts/blob/master/tests/integration/VotingEscrow/test_voting_escrow.py
  describe("#complex", async () => {
    /**
     *
     * Test voting power in the following scenario.
     * Alice:
     * ~~~~~~~
     * ^
     * | *       *
     * | | \     |  \
     * | |  \    |    \
     * +-+---+---+------+---> t
     *
     * Bob:
     * ~~~~~~~
     * ^
     * |         *
     * |         | \
     * |         |  \
     * +-+---+---+---+--+---> t
     *
     * Alice has 100% of voting power in the first period.
     * She has 2/3 power at the start of 2nd period, with Bob having 1/2 power
     * (due to smaller locktime).
     * Alice's power grows to 100% by Bob's unlock.
     *
     * Checking that totalSupply is appropriate.
     *
     * After the test is done, check all over again with balanceOfAt / totalSupplyAt
     */

    it("should work", async () => {
      // prepare
      const stages: any = {};
      const lockAmount = ethers.utils.parseEther("1000");
      await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
      await ALPACAasBob.approve(xALPACA.address, ethers.constants.MaxUint256);

      expect(await xALPACA.totalSupply()).to.be.eq("0");
      expect(await xALPACA.supply()).to.be.eq("0");
      expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq("0");
      expect(await xALPACA.balanceOf(bobAddress)).to.be.eq("0");

      // Set time to start of the next week (Unix start week, not typical start week)
      await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

      // Increase time by one hour
      await timeHelpers.increaseTimestamp(HOUR);

      stages["beforeDeposits"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];
      await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK).add(1));
      stages["aliceDeposit"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

      // Increase time by one hour
      await timeHelpers.increaseTimestamp(HOUR);

      // The following states must be satisfy:
      // - balanceOf Alice should close to lockAmount / MAX_LOCK * WEEK - (2 * HOUR) due to
      // Alice lock 1 week and it is already passed 2 hours.
      // - totalSupply should close to lockAmount / MAX_LOCK * WEEK - (2 * HOUR) due to
      // There is only Alice that lock ALPACA at this point of time.
      // - xALPACA.supply() should be the lockAmount
      // - totalSupply should be the same as Alice's balance
      // - Bob's balance should be 0
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR.mul(2))),
        await xALPACAasAlice.balanceOf(aliceAddress),
        TOLERANCE
      );
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR.mul(2))),
        await xALPACA.totalSupply(),
        TOLERANCE
      );
      expect(await xALPACA.supply()).to.be.eq(lockAmount);
      expect(await xALPACA.totalSupply()).to.be.eq(await xALPACAasAlice.balanceOf(aliceAddress));
      expect(await xALPACAasBob.balanceOf(bobAddress)).to.be.eq(0);

      let t0 = await timeHelpers.latestTimestamp();

      stages["aliceIn0"] = [];
      stages["aliceIn0"].push([await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()]);

      // Loop through 7 days to decay Alice's xALPACA
      for (let i = 0; i < 7; i++) {
        // Move up 1 day
        await timeHelpers.increaseTimestamp(DAY);
        const timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);

        // The following conditions must be satisfied:
        // - balanceOf Alice must be lockAmount / MAX_LOCK * MAX(WEEK - (2 * HOUR) - (CURRENT-T0))
        // - totalSupply Alice must be lockAmount / MAX_LOCK * MAX(WEEK - (2 * HOUR) - (CURRENT-T0))
        // - balanceOf Bob must be 0
        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.totalSupply(),
          lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.sub(HOUR.mul(2)).sub(timeDelta), 0)),
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          await xALPACAasAlice.balanceOf(aliceAddress),
          lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.sub(HOUR.mul(2)).sub(timeDelta), 0)),
          TOLERANCE
        );
        expect(await xALPACAasBob.balanceOf(bobAddress)).to.be.eq(0);
        stages["aliceIn0"].push([await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()]);
      }

      // Increase time by 1 hour to make sure that Alice's lock is expired
      await timeHelpers.increaseTimestamp(HOUR);

      // Expect that balanceOf Alice should be 0
      expect(await xALPACAasAlice.balanceOf(aliceAddress)).to.be.eq(0);

      // Alice withdraws her ALPACA
      let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
      await xALPACAasAlice.withdraw();
      let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);

      // States should be fresh & Alice should get lockAmount ALPACA back
      expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(lockAmount);
      expect(await xALPACA.totalSupply()).to.be.eq("0");
      expect(await xALPACA.supply()).to.be.eq("0");
      expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq("0");
      expect(await xALPACA.balanceOf(bobAddress)).to.be.eq("0");

      // ==== Finish Alice's 1st graph ====

      await timeHelpers.increaseTimestamp(HOUR);

      // Set time to start of the next week (Unix start week, not typical start week)
      await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

      await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(2)));
      stages["aliceDeposit2"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

      // The following states must be satisfy:
      // - balanceOf Alice should close to lockAmount / MAX_LOCK * (WEEK * 2) due to
      // Alice lock 2 weeks.
      // - totalSupply should close to lockAmount / MAX_LOCK * (WEEK * 2) due to
      // There is only Alice that lock ALPACA at this point of time.
      // - xALPACA.supply() should be the lockAmount
      // - totalSupply should be the same as Alice's balance
      // - Bob's balance should be 0
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)),
        await xALPACAasAlice.balanceOf(aliceAddress),
        TOLERANCE
      );
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)),
        await xALPACA.totalSupply(),
        TOLERANCE
      );
      expect(await xALPACA.supply()).to.be.eq(lockAmount);
      expect(await xALPACA.totalSupply()).to.be.eq(await xALPACAasAlice.balanceOf(aliceAddress));
      expect(await xALPACAasBob.balanceOf(bobAddress)).to.be.eq(0);

      await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));
      stages["bobDeposit2"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

      // The following states must be satisfied:
      // - totalSupply = [lockAmount / MAX_LOCK * (2 * WEEK)] <Alice> + [lockAmount / MAX_LOCK * WEEK] <Bob>
      // - balanceOf(Alice) = [lockAmount / MAX_LOCK * (2 * WEEK)]
      // - balanceOf(Bob) = [lockAmount / MAX_LOCK * WEEK]
      // - supply = lockAmount + lockAmount
      // - totalSupply = balanceOf(Alice) + balanceOf(Bob)
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)).add(lockAmount.div(MAX_LOCK).mul(WEEK)),
        await xALPACA.totalSupply(),
        TOLERANCE
      );
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)),
        await xALPACAasAlice.balanceOf(aliceAddress),
        TOLERANCE
      );
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK),
        await xALPACAasBob.balanceOf(bobAddress),
        TOLERANCE
      );

      t0 = await timeHelpers.latestTimestamp();
      await timeHelpers.increaseTimestamp(HOUR);

      // Loop through weeks to decay Bob's xALPACA
      stages["aliceBobIn2"] = [];
      for (let i = 0; i < 7; i++) {
        await timeHelpers.increaseTimestamp(DAY);

        const timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);
        const totalSupply = await xALPACA.totalSupply();
        const aliceBalance = await xALPACA.balanceOf(aliceAddress);
        const bobBalance = await xALPACA.balanceOf(bobAddress);

        // The following states must be satisfied:
        // - balanceOf(Alice) = [lockAmount / MAX_LOCK * (2 * WEEK - TimeDelta)]
        // - balanceOf(Bob) = [lockAmount / MAX_LOCK * (WEEK - TimeDelta)]
        // - totalSupply = balanceOf(Alice) + balanceOf(Bob)
        expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
        assertHelpers.assertBigNumberClosePercent(
          lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.mul(2).sub(timeDelta), 0)),
          aliceBalance,
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.sub(timeDelta), 0)),
          bobBalance,
          TOLERANCE
        );
        stages["aliceBobIn2"].push([await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()]);
      }

      // Increase 1 hour to make sure that Bob's lock has expired
      await timeHelpers.increaseTimestamp(HOUR);

      // Bob withdraw his ALPACA from xALPACA
      let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
      await xALPACAasBob.withdraw();
      let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
      t0 = await timeHelpers.latestTimestamp();
      stages["bobWithdraw1"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

      // The following conditions must be satisfied:
      // - totalSupply = balanceOf(Alice)
      // - Bob's ALPACA should increase by lockAmount
      // - balanceOf(Alice) & totalSupply = lockAmount / MAX_LOCK * (WEEK * 2 - (WEEK + (HOUR * 2)))
      // - balanceOf(Bob) should be 0
      expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
      expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(lockAmount);
      assertHelpers.assertBigNumberClosePercent(
        lockAmount.div(MAX_LOCK).mul(WEEK.mul(2).sub(WEEK.add(HOUR.mul(2)))),
        await xALPACA.totalSupply(),
        TOLERANCE
      );
      expect(await xALPACA.balanceOf(bobAddress)).to.be.eq(0);

      // Increase time by 1 hour
      await timeHelpers.increaseTimestamp(HOUR);

      stages["aliceIn2"] = [];
      for (let i = 0; i < 7; i++) {
        await timeHelpers.increaseTimestamp(DAY);
        const timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);
        const totalSupply = await xALPACA.totalSupply();
        const aliceBalance = await xALPACA.balanceOf(aliceAddress);
        const bobBalance = await xALPACA.balanceOf(bobAddress);

        // The following conditions must be satisfied:
        // - totalSupply = balanceOf(Alice)
        // - Bob's ALPACA should increase by lockAmount
        // - balanceOf(Alice) & totalSupply = lockAmount / MAX_LOCK * MAX(WEEK * 2 - (WEEK + (HOUR * 2) - TimeDelta), 0)
        // - balanceOf(Bob) should be 0
        expect(totalSupply).to.be.eq(aliceBalance);
        assertHelpers.assertBigNumberClosePercent(
          lockAmount.div(MAX_LOCK).mul(
            mathHelpers.max(
              WEEK.mul(2)
                .sub(WEEK.add(HOUR.mul(2)))
                .sub(timeDelta),
              0
            )
          ),
          aliceBalance,
          TOLERANCE
        );
        expect(bobBalance).to.be.eq(0);
        stages["aliceIn2"].push([await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()]);
      }

      aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
      await xALPACAasAlice.withdraw();
      aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);

      // The following conditions are expected:
      // - Alice's ALPACA grows by lockAmount
      // - balanceOf(Alice) = 0
      expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(lockAmount);
      expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq(0);

      // Increase time by 1 hour
      await timeHelpers.increaseTimestamp(HOUR);

      // Bob try to withdraw but his lock is already 0
      bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
      await xALPACAasBob.withdraw();
      bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);

      // The following conditions are expected:
      // - Bob's ALPACA must remain the same
      // - balanceOf(Bob) = 0
      expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(0);
      expect(await xALPACA.balanceOf(bobAddress)).to.be.eq(0);

      // Total Supply must be 0
      expect(await xALPACA.totalSupply()).to.be.eq(0);

      // === Finish latest states test ===
      // === Now move to historical xxxAt test ===
      expect(await xALPACA.balanceOfAt(aliceAddress, stages["beforeDeposits"][0])).to.be.eq(0);
      expect(await xALPACA.balanceOfAt(bobAddress, stages["beforeDeposits"][0])).to.be.eq(0);
      expect(await xALPACA.totalSupplyAt(stages["beforeDeposits"][0])).to.be.eq(0);

      const aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit"][0].add(10));
      console.log(stages["aliceDeposit"][0]);
      console.log(aliceBalance.toString());
      assertHelpers.assertBigNumberClosePercent(aliceBalance, lockAmount.div(MAX_LOCK).mul(WEEK), TOLERANCE);
    });
  });
});
