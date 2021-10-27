import { ethers, waffle } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
  GrassHouse,
  GrassHouse__factory,
  MockContractContext,
  MockContractContext__factory,
  XALPACA,
  XALPACA__factory,
} from "../typechain";
import * as timeHelpers from "./helpers/time";
import * as assertHelpers from "./helpers/assert";
import * as mathHelpers from "./helpers/math";

chai.use(solidity);
const { expect } = chai;

describe("GrassHouse", () => {
  const TOLERANCE = "0.04"; // 0.04%
  const HOUR = ethers.BigNumber.from(3600);
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);
  const YEAR = DAY.mul(365);
  const MAX_LOCK = ethers.BigNumber.from(126144000);
  const TOKEN_CHECKPOINT_DEADLINE = DAY;

  // Contact Instance
  let ALPACA: BEP20;
  let xALPACA: XALPACA;
  let grassHouse: GrassHouse;

  let contractContext: MockContractContext;

  // GrassHouse start week cursor
  let startWeekCursor: BigNumber;

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

  let grassHouseAsAlice: GrassHouse;
  let grassHouseAsBob: GrassHouse;
  let grassHouseAsEve: GrassHouse;

  async function fixture() {
    [deployer, alice, bob, eve] = await ethers.getSigners();
    [deployerAddress, aliceAddress, bobAddress, eveAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      eve.getAddress(),
    ]);

    // Deploy contract context
    const MockContractContext = (await ethers.getContractFactory(
      "MockContractContext",
      deployer
    )) as MockContractContext__factory;
    contractContext = await MockContractContext.deploy();

    // Deploy ALPACA
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    ALPACA = await BEP20.deploy("ALPACA", "ALPACA");
    await ALPACA.mint(deployerAddress, ethers.utils.parseEther("888888888888888"));

    // Deploy xALPACA
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xALPACA = await XALPACA.deploy(ALPACA.address);

    // Distribute ALPACA and approve xALPACA to do "transferFrom"
    for (let i = 0; i < 10; i++) {
      await ALPACA.transfer((await ethers.getSigners())[i].address, ethers.utils.parseEther("8888"));
      const alpacaWithSigner = BEP20__factory.connect(ALPACA.address, (await ethers.getSigners())[i]);
      await alpacaWithSigner.approve(xALPACA.address, ethers.constants.MaxUint256);
    }

    // Deploy GrassHouse
    startWeekCursor = (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK);
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    grassHouse = await GrassHouse.deploy(
      xALPACA.address,
      await timeHelpers.latestTimestamp(),
      ALPACA.address,
      deployerAddress
    );

    // Approve xALPACA to transferFrom contractContext
    await contractContext.executeTransaction(
      ALPACA.address,
      0,
      "approve(address,uint256)",
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [xALPACA.address, ethers.constants.MaxUint256])
    );

    // Assign contract signer
    ALPACAasAlice = BEP20__factory.connect(ALPACA.address, alice);
    ALPACAasBob = BEP20__factory.connect(ALPACA.address, bob);
    ALPACAasEve = BEP20__factory.connect(ALPACA.address, eve);

    xALPACAasAlice = XALPACA__factory.connect(xALPACA.address, alice);
    xALPACAasBob = XALPACA__factory.connect(xALPACA.address, bob);
    xALPACAasEve = XALPACA__factory.connect(xALPACA.address, eve);

    grassHouseAsAlice = GrassHouse__factory.connect(grassHouse.address, alice);
    grassHouseAsBob = GrassHouse__factory.connect(grassHouse.address, bob);
    grassHouseAsEve = GrassHouse__factory.connect(grassHouse.address, eve);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("#initialized", async () => {
    it("should initialized correctly", async () => {
      expect(await grassHouse.startWeekCursor()).to.be.eq(startWeekCursor);
      expect(await grassHouse.lastTokenTimestamp()).to.be.eq(startWeekCursor);
      expect(await grassHouse.weekCursor()).to.be.eq(startWeekCursor);
      expect(await grassHouse.rewardToken()).to.be.eq(ALPACA.address);
      expect(await grassHouse.xALPACA()).to.be.eq(xALPACA.address);
      expect(await grassHouse.emergencyReturn()).to.be.eq(deployerAddress);
      expect(await grassHouse.canCheckpointToken()).to.be.eq(false);
    });
  });

  describe("#checkpointTotalSupply", async () => {
    context("when checkpoint total supply is called", async () => {
      it("should has the same total supply as in xALPACA", async () => {
        // Setup input
        const amounts: Array<BigNumber> = [];
        const lockTimes: Array<BigNumber> = [];
        const sleeps: Array<BigNumber> = [];
        for (let i = 0; i < 10; i++) {
          amounts.push(ethers.utils.parseEther(mathHelpers.random(1, 100).toString()));
          lockTimes.push(ethers.BigNumber.from(mathHelpers.random(1, 52).toString()));
          sleeps.push(ethers.BigNumber.from(mathHelpers.random(1, 30).toString()));
        }

        // Create locks based on input
        let finalLock = ethers.BigNumber.from(0);
        for (let i = 0; i < 10; i++) {
          // Increase timestamp according to sleeps in DAY
          await timeHelpers.increaseTimestamp(sleeps[i].mul(DAY));
          // Getting lockTime
          const lockTime = (await timeHelpers.latestTimestamp()).add(WEEK.mul(lockTimes[i]));
          finalLock = mathHelpers.max(lockTime, finalLock);
          // Do the actual lock
          const xAlpacaWithSigner = XALPACA__factory.connect(xALPACA.address, (await ethers.getSigners())[i]);
          await xAlpacaWithSigner.createLock(amounts[i], lockTime);
        }

        while ((await timeHelpers.latestTimestamp()).lt(finalLock)) {
          const weekEpoch = (await timeHelpers.latestTimestamp()).add(WEEK).div(WEEK).mul(WEEK);
          await timeHelpers.setTimestamp(weekEpoch);
          const weekBlock = await timeHelpers.latestBlockNumber();

          // Maximum lock is 52 weeks away, 1 checkpointTotalSupply filled 20 weeks max
          // So 3 times enoguh to go over 52 weeks
          for (let i = 0; i < 3; i++) {
            await grassHouse.checkpointTotalSupply();
          }

          expect(await grassHouse.xSupply(weekEpoch)).to.be.eq(await xALPACA.totalSupplyAt(weekBlock));
        }
      });
    });
  });

  describe("#claim", async () => {
    context("when Alice joined xALPACA after rewards distributed", async () => {
      it("should distribute W1 rewards to Alice given Alice locked ALPACA at W", async () => {
        // Steps:
        // 1. Deployer feed small amount of rewardTokens to fill rewards for W.
        // 2. Alice lock ALPACA at [W1 - some unix]
        // 3. Move timestamp to W1
        // 4. Deployer call checkpoint to move lastTokenTimestamp to W+1 to allocate rewards
        // on the next call to W1 and W2 only.
        // 5. Move timestamp to W2
        // 6. Deployer feed rewardTokens to GrassHouse and call checkpointToken
        // 7. Alice should get all W1 rewards at W2 as she locked ALPACA at W

        // Preparation
        const stages: any = {};
        const initAmount = ethers.utils.parseEther("5");
        const feedAmount = ethers.utils.parseEther("95");
        const lockAmount = ethers.utils.parseEther("1");
        const lastTokenTimestamp = await grassHouse.lastTokenTimestamp();

        // 1. Deployer feed small amount of rewardTokens to fill rewards for deployed week.
        await ALPACA.transfer(grassHouse.address, initAmount);
        await grassHouse.checkpointToken();

        // 2. Alice lock ALPACA at current timestamp
        console.log(await xALPACA.epoch());
        const aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(YEAR));
        const aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
        console.log(await xALPACA.epoch());
        // Expect that Alice's ALPACA get locked and she has xALPACA balance
        expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

        // 3. Move timestamp to W1
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // 4. Deployer call checkpoint to move lastTokenTimestamp to W+1 to allocate rewards
        // on the next call to W+1 and W+2 only.
        stages["oneWeekAfterAliceLock"] = [await timeHelpers.latestTimestamp(), await timeHelpers.latestBlockNumber()];
        await grassHouse.checkpointToken();
        await ALPACA.transfer(grassHouse.address, feedAmount);
        await grassHouse.checkpointToken();
        await grassHouse.setCanCheckpointToken(true);

        // 5. Move timestamp to W2
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK).add(DAY));

        // 6. Deployer feed rewardTokens to GrassHouse and call checkpointToken
        expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.add(initAmount));
        expect(await grassHouse.lastTokenTimestamp()).to.be.gt(lastTokenTimestamp);

        // 7. Alice should get some rewardTokens as she locked ALPACA before the start of the next week
        const w1 = await grassHouse.tokensPerWeek(stages["oneWeekAfterAliceLock"][0]);
        console.log(w1);
        expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(w1);
      });
    });
  });

  describe("#feed", async () => {
    context("when canCheckpointToken is off", async () => {
      it("should move rewards without checkpointToken", async () => {
        const lastTokenTimestamp = await grassHouse.lastTokenTimestamp();

        await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
        await grassHouse.feed(ethers.utils.parseEther("100"));

        expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(ethers.utils.parseEther("100"));
        expect(await grassHouse.lastTokenTimestamp()).to.be.eq(lastTokenTimestamp);
      });
    });

    context("when canCheckpointToken is on", async () => {
      context("when block.timestamp > lastTokenTimestamp + TOKEN_CHECKPOINT_DEADLINE", async () => {
        it("should move rewards and checkpointToken", async () => {
          const lastTokenTimestamp = await grassHouse.lastTokenTimestamp();

          await grassHouse.setCanCheckpointToken(true);
          await timeHelpers.increaseTimestamp(TOKEN_CHECKPOINT_DEADLINE);
          await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
          await grassHouse.feed(ethers.utils.parseEther("100"));

          expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(ethers.utils.parseEther("100"));
          expect(await grassHouse.lastTokenTimestamp()).to.be.gt(lastTokenTimestamp);
        });
      });

      context("when feed reward tokens happened after 20 weeks", async () => {
        it("should iterate through 20 weeks to fill all tokensPerWeek equally", async () => {
          const lastTokenTimestamp = await grassHouse.lastTokenTimestamp();
          const feedAmount = ethers.utils.parseEther("100");

          // Set time to start of the next 20 weeks (Unix start week, not typical start week)
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(20).mul(WEEK));

          await grassHouse.setCanCheckpointToken(true);
          await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
          await grassHouse.feed(feedAmount);

          let weekCursor = startWeekCursor;
          for (let i = 0; i < 20; i++) {
            assertHelpers.assertBigNumberClosePercent(
              await grassHouse.tokensPerWeek(weekCursor),
              feedAmount.div(20),
              TOLERANCE
            );
            weekCursor = weekCursor.add(WEEK);
          }

          expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(ethers.utils.parseEther("100"));
          expect(await grassHouse.lastTokenTimestamp()).to.be.gt(lastTokenTimestamp);
        });
      });
    });
  });

  describe("#xBalanceAt", async () => {
    context("when multiple users use xALPACA", async () => {
      it("should return the correct xALPACA balance of each user", async () => {
        // This case is the same as #complex in xALPACA.test.ts,
        // however we add grassHouse.xBalanceOfAt() assertion

        // prepare
        const stages: any = {};
        const lockAmount = ethers.utils.parseEther("1000");
        let timeDelta,
          aliceBalance,
          aliceGrassHouseBalance,
          totalSupply,
          bobBalance,
          bobGrassHouseBalance = ethers.BigNumber.from(0);
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
          timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);

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

        // Increase time by 1 hour to make sure that Alice's lock is expired & make block move
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

        stages["aliceWithdraw"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

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

          timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);
          totalSupply = await xALPACA.totalSupply();
          aliceBalance = await xALPACA.balanceOf(aliceAddress);
          bobBalance = await xALPACA.balanceOf(bobAddress);

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
          timeDelta = (await timeHelpers.latestTimestamp()).sub(t0);
          totalSupply = await xALPACA.totalSupply();
          aliceBalance = await xALPACA.balanceOf(aliceAddress);
          bobBalance = await xALPACA.balanceOf(bobAddress);

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

        stages["bobWithdraw2"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

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
        expect(await grassHouse.xBalanceAt(aliceAddress, stages["beforeDeposits"][1])).to.be.eq(0);
        expect(await grassHouse.xBalanceAt(bobAddress, stages["beforeDeposits"][1])).to.be.eq(0);
        expect(await xALPACA.totalSupplyAt(stages["beforeDeposits"][0])).to.be.eq(0);

        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit"][0]);
        assertHelpers.assertBigNumberClosePercent(
          aliceBalance,
          lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR)),
          TOLERANCE
        );
        expect(aliceBalance).to.be.eq(await grassHouse.xBalanceAt(aliceAddress, stages["aliceDeposit"][1]));
        expect(await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit"][0])).to.be.eq(0);
        expect(await grassHouse.xBalanceAt(bobAddress, stages["aliceDeposit"][1])).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit"][0]);
        expect(totalSupply).to.be.eq(aliceBalance);

        for (const [index, ele] of stages["aliceIn0"].entries()) {
          aliceBalance = await xALPACA.balanceOfAt(aliceAddress, ele[0]);
          aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, ele[1]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

          expect(bobBalance).to.be.eq(0);
          expect(bobBalance).to.eq(bobGrassHouseBalance);
          expect(aliceBalance).to.be.eq(totalSupply);
          expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);

          const timeLeft = WEEK.mul(ethers.BigNumber.from(7).sub(index)).div(ethers.BigNumber.from(7).sub(HOUR.mul(2)));
          assertHelpers.assertBigNumberClosePercent(aliceBalance, lockAmount.div(MAX_LOCK.mul(timeLeft)), TOLERANCE);
        }

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceWithdraw"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceWithdraw"][0]);
        aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, stages["aliceWithdraw"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceWithdraw"][0]);
        bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, stages["aliceWithdraw"][1]);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(aliceBalance).to.be.eq(totalSupply);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(totalSupply).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit2"][0]);
        aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, stages["aliceDeposit2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit2"][0]);
        bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, stages["aliceDeposit2"][1]);
        assertHelpers.assertBigNumberClosePercent(lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)), totalSupply, TOLERANCE);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(totalSupply).to.be.eq(aliceBalance);
        expect(bobBalance).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["bobDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["bobDeposit2"][0]);
        aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, stages["bobDeposit2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobDeposit2"][0]);
        bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, stages["bobDeposit2"][1]);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(aliceBalance.add(bobBalance)).to.be.eq(totalSupply);
        assertHelpers.assertBigNumberClosePercent(
          lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)).add(lockAmount.div(MAX_LOCK).mul(WEEK)),
          totalSupply
        );
        assertHelpers.assertBigNumberClosePercent(lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)), aliceBalance);
        assertHelpers.assertBigNumberClosePercent(lockAmount.div(MAX_LOCK).mul(WEEK), bobBalance);

        t0 = stages["bobDeposit2"][1];
        for (const [index, ele] of stages["aliceBobIn2"].entries()) {
          aliceBalance = await xALPACA.balanceOfAt(aliceAddress, ele[0]);
          aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, ele[1]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

          expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
          expect(bobBalance).to.eq(bobGrassHouseBalance);
          expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
          timeDelta = ele[1].sub(t0);

          assertHelpers.assertBigNumberClosePercent(
            aliceBalance,
            lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.mul(2).sub(timeDelta), 0)),
            TOLERANCE
          );
          assertHelpers.assertBigNumberClosePercent(
            bobAddress,
            lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.sub(timeDelta), 0)),
            TOLERANCE
          );
        }

        totalSupply = await xALPACA.totalSupplyAt(stages["bobWithdraw1"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["bobWithdraw1"][0]);
        aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, stages["bobWithdraw1"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw1"][0]);
        bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, stages["bobWithdraw1"][1]);

        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(totalSupply).to.be.eq(aliceBalance);
        assertHelpers.assertBigNumberClosePercent(
          lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR.mul(2))),
          totalSupply,
          TOLERANCE
        );
        expect(bobBalance).to.be.eq(0);

        t0 = stages["bobWithdraw1"][1];
        for (const [index, ele] of stages["aliceIn2"].entries()) {
          aliceBalance = await xALPACA.balanceOfAt(aliceAddress, ele[0]);
          aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, ele[1]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

          expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
          expect(bobBalance).to.eq(bobGrassHouseBalance);
          expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
          timeDelta = ele[1].sub(t0);

          assertHelpers.assertBigNumberClosePercent(
            aliceBalance,
            lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.mul(2).sub(timeDelta), 0)),
            TOLERANCE
          );
          assertHelpers.assertBigNumberClosePercent(
            bobAddress,
            lockAmount.div(MAX_LOCK).mul(mathHelpers.max(WEEK.sub(timeDelta), 0)),
            TOLERANCE
          );
        }

        totalSupply = await xALPACA.totalSupplyAt(stages["bobWithdraw2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["bobWithdraw2"][0]);
        aliceGrassHouseBalance = await grassHouse.xBalanceAt(aliceAddress, stages["bobWithdraw2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw2"][0]);
        bobGrassHouseBalance = await grassHouse.xBalanceAt(bobAddress, stages["bobWithdraw2"][1]);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
        expect(totalSupply).to.be.eq(0);
      });
    });
  });
});
