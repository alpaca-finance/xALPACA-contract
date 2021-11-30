import { ethers, waffle, upgrades } from "hardhat";
import { Signer, BigNumber, BigNumberish } from "ethers";
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
} from "../../typechain";
import * as timeHelpers from "../helpers/time";
import * as assertHelpers from "../helpers/assert";
import * as mathHelpers from "../helpers/math";

chai.use(solidity);
const { expect } = chai;

describe("GrassHouse", () => {
  const TOLERANCE = "0.04"; // 0.04%
  const HOUR = ethers.BigNumber.from(3600);
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);
  const YEAR = DAY.mul(365);
  const MAX_LOCK = ethers.BigNumber.from(31536000); // seconds in 1 year (60 * 60 * 24 * 365)
  const TOKEN_CHECKPOINT_DEADLINE = DAY;

  // Contact Instance
  let ALPACA: BEP20;
  let DTOKEN: BEP20;

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

  let DTOKENasAlice: BEP20;
  let DTOKENasBob: BEP20;
  let DTOKENasEve: BEP20;

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

    // Deploy ALPACA & DTOKEN
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    ALPACA = await BEP20.deploy("ALPACA", "ALPACA");
    await ALPACA.mint(deployerAddress, ethers.utils.parseEther("888888888888888"));
    DTOKEN = await BEP20.deploy("DTOKEN", "DTOKEN");
    await DTOKEN.mint(deployerAddress, ethers.utils.parseEther("888888888888888"));

    // Deploy xALPACA
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xALPACA = (await upgrades.deployProxy(XALPACA, [ALPACA.address])) as XALPACA;
    await xALPACA.deployed();

    // Distribute ALPACA and approve xALPACA to do "transferFrom"
    for (let i = 0; i < 10; i++) {
      await ALPACA.transfer((await ethers.getSigners())[i].address, ethers.utils.parseEther("8888"));
      const alpacaWithSigner = BEP20__factory.connect(ALPACA.address, (await ethers.getSigners())[i]);
      await alpacaWithSigner.approve(xALPACA.address, ethers.constants.MaxUint256);
    }

    // Deploy GrassHouse
    startWeekCursor = (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK);
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    grassHouse = (await upgrades.deployProxy(GrassHouse, [
      xALPACA.address,
      await timeHelpers.latestTimestamp(),
      ALPACA.address,
      deployerAddress,
    ])) as GrassHouse;
    await grassHouse.deployed();

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

    DTOKENasAlice = BEP20__factory.connect(DTOKEN.address, alice);
    DTOKENasBob = BEP20__factory.connect(DTOKEN.address, bob);
    DTOKENasEve = BEP20__factory.connect(DTOKEN.address, eve);

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

  describe("#checkpointToken", async () => {
    context("when owner call checkpointToken", async () => {
      it("should work", async () => {
        const latestTimestamp = await timeHelpers.latestTimestamp();
        await ALPACA.transfer(grassHouse.address, ethers.utils.parseEther("888"));
        await expect(grassHouse.checkpointToken()).to.be.emit(grassHouse, "LogCheckpointToken");

        expect(await grassHouse.lastTokenBalance()).to.be.eq(ethers.utils.parseEther("888"));
        expect(await grassHouse.lastTokenTimestamp()).to.be.gt(latestTimestamp);
        expect(await grassHouse.tokensPerWeek((await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK))).to.be.eq(
          ethers.utils.parseEther("888")
        );
      });
    });

    context("when user call checkpointToken", async () => {
      context("when canCheckpointToken is false", async () => {
        it("should revert", async () => {
          await expect(grassHouseAsAlice.checkpointToken()).to.be.revertedWith("!allow");
        });
      });

      context("when canCheckpointToken is allow", async () => {
        context("when block.timstamp <= lastTokenTimestamp + 1 day", async () => {
          it("should revert", async () => {
            // Set canCheckpointToken to true
            await grassHouse.setCanCheckpointToken(true);

            // Move to start of the week and call checkpoint to move lastTokenTimestamp
            await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));
            await grassHouse.checkpointToken();

            // Alice call checkpointToken immediately
            // Expect to be reverted as block.timestamp <= lastTokenTimestamp + 1 day
            await expect(grassHouseAsAlice.checkpointToken()).to.be.revertedWith("!allow");
          });
        });

        context("when block.timestamp > lastTokenTimestamp + 1 day", async () => {
          it("should work", async () => {
            await grassHouse.setCanCheckpointToken(true);

            const latestTimestamp = await timeHelpers.latestTimestamp();

            await timeHelpers.setTimestamp(latestTimestamp.add(DAY).add(1));

            await ALPACA.transfer(grassHouse.address, ethers.utils.parseEther("888"));
            await expect(grassHouseAsAlice.checkpointToken()).to.be.emit(grassHouse, "LogCheckpointToken");

            expect(await grassHouse.lastTokenBalance()).to.be.eq(ethers.utils.parseEther("888"));
            expect(await grassHouse.lastTokenTimestamp()).to.be.gt(latestTimestamp);
            expect(await grassHouse.tokensPerWeek((await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK))).to.be.eq(
              ethers.utils.parseEther("888")
            );
          });
        });
      });
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

        // Move to next week & call checkpointTotalSupply
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));
        await grassHouse.checkpointTotalSupply();
        expect(await grassHouse.totalSupplyAt((await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK))).to.be.eq(0);

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

          expect(await grassHouse.totalSupplyAt(weekEpoch)).to.be.eq(await xALPACA.totalSupplyAt(weekBlock));
        }
      });
    });

    context("when checkpoint total supply is called after all lock expired", async () => {
      it("should return handle correctly (totalSupplyAt(xxx) should return 0)", async () => {
        // prepare
        const stages: any = {};
        const lockAmount = ethers.utils.parseEther("1000");
        // Move blocktimestamp to start of the week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice lock her ALPACA
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(4)));

        // Move time to after Alice's unlock time
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(8).mul(WEEK));

        // Deploy new grass house
        const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
        const dTokenGrassHouse = (await upgrades.deployProxy(GrassHouse, [
          xALPACA.address,
          await timeHelpers.latestTimestamp(),
          DTOKEN.address,
          deployerAddress,
        ])) as GrassHouse;

        await dTokenGrassHouse.deployed();

        // Checkpoint total supply
        await dTokenGrassHouse.checkpointTotalSupply();
        expect(
          await dTokenGrassHouse.totalSupplyAt((await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK))
        ).to.be.eq(0);
      });
    });
  });

  describe("#claim", async () => {
    context("when user with no lock try to claim", async () => {
      it("should return 0", async () => {
        expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(0);
      });
    });
  });

  describe("#feed", async () => {
    context("when canCheckpointToken is off", async () => {
      it("should move rewards without checkpointToken", async () => {
        const lastTokenTimestamp = await grassHouse.lastTokenTimestamp();

        await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
        expect(await grassHouse.feed(ethers.utils.parseEther("100"))).to.be.emit(grassHouse, "LogFeed");

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
          expect(await grassHouse.feed(ethers.utils.parseEther("100"))).to.be.emit(grassHouse, "LogFeed");

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
          expect(await grassHouse.feed(feedAmount)).to.be.emit(grassHouse, "LogFeed");

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

  describe("#balanceOfAt", async () => {
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
        expect(await grassHouse.balanceOfAt(aliceAddress, stages["beforeDeposits"][1])).to.be.eq(0);
        expect(await grassHouse.balanceOfAt(bobAddress, stages["beforeDeposits"][1])).to.be.eq(0);
        expect(await xALPACA.totalSupplyAt(stages["beforeDeposits"][0])).to.be.eq(0);

        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit"][0]);
        assertHelpers.assertBigNumberClosePercent(
          aliceBalance,
          lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR)),
          TOLERANCE
        );
        expect(aliceBalance).to.be.eq(await grassHouse.balanceOfAt(aliceAddress, stages["aliceDeposit"][1]));
        expect(await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit"][0])).to.be.eq(0);
        expect(await grassHouse.balanceOfAt(bobAddress, stages["aliceDeposit"][1])).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit"][0]);
        expect(totalSupply).to.be.eq(aliceBalance);

        for (const [index, ele] of stages["aliceIn0"].entries()) {
          aliceBalance = await xALPACA.balanceOfAt(aliceAddress, ele[0]);
          aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, ele[1]);
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
        aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, stages["aliceWithdraw"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceWithdraw"][0]);
        bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, stages["aliceWithdraw"][1]);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(aliceBalance).to.be.eq(totalSupply);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(totalSupply).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit2"][0]);
        aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, stages["aliceDeposit2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit2"][0]);
        bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, stages["aliceDeposit2"][1]);
        assertHelpers.assertBigNumberClosePercent(lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)), totalSupply, TOLERANCE);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(totalSupply).to.be.eq(aliceBalance);
        expect(bobBalance).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["bobDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["bobDeposit2"][0]);
        aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, stages["bobDeposit2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobDeposit2"][0]);
        bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, stages["bobDeposit2"][1]);
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
          aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, ele[1]);
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
        aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, stages["bobWithdraw1"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw1"][0]);
        bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, stages["bobWithdraw1"][1]);

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
          aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, ele[1]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, ele[1]);
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
        aliceGrassHouseBalance = await grassHouse.balanceOfAt(aliceAddress, stages["bobWithdraw2"][1]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw2"][0]);
        bobGrassHouseBalance = await grassHouse.balanceOfAt(bobAddress, stages["bobWithdraw2"][1]);
        expect(aliceBalance).to.be.eq(aliceGrassHouseBalance);
        expect(bobBalance).to.eq(bobGrassHouseBalance);
        expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
        expect(totalSupply).to.be.eq(0);
      });
    });

    context("when call balanceOfAt(user, unlockTime + 1)", async () => {
      it("should return 0", async () => {
        // prepare
        const stages: any = {};
        const lockAmount = ethers.utils.parseEther("1000");
        // Move blocktimestamp to start of the week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice lock her ALPACA
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));
        stages["aliceUnlock"] = [(await timeHelpers.latestTimestamp()).add(WEEK)];

        // Check Alice balanceOfAt unlockTime + 1 second
        expect(await grassHouse.balanceOfAt(aliceAddress, stages["aliceUnlock"][0].add(1))).to.be.eq(0);
      });
    });

    context("when user never lock ALPACA", async () => {
      it("should return 0", async () => {
        expect(await grassHouse.balanceOfAt(aliceAddress, await timeHelpers.latestTimestamp())).to.be.eq(0);
      });
    });
  });

  describe("#complex", async () => {
    async function calExpectedRewardsAtTimestamp(
      grassHouse: GrassHouse,
      address: string,
      blockTimestamp: BigNumberish
    ): Promise<BigNumber> {
      const rewardsAtBlockTimestamp = await grassHouse.tokensPerWeek(blockTimestamp);
      const xALPACAbalance = await grassHouse.balanceOfAt(address, blockTimestamp);
      const totalSupply = await grassHouse.totalSupplyAt(blockTimestamp);

      let expectedRewards = ethers.BigNumber.from("0");
      if (totalSupply.gt(0)) expectedRewards = xALPACAbalance.mul(rewardsAtBlockTimestamp).div(totalSupply);

      return expectedRewards;
    }

    context("when Alice lock ALPACA at the middle of W1 and W2", async () => {
      context("when deployer feed rewards at W2 only", async () => {
        it("should distribute W2-W3 rewards to Alice correctly", async () => {
          // Steps:
          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          // 2. Alice lock ALPACA at [W1 + 1 day]
          // 3. Move timestamp to W2
          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
          // 5. Move timestamp to W3
          // 6. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          // Timeline:
          //                           3             5
          //             1 2           4             6
          // ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ▶ Time (DAY)
          //             W1            W2            W3

          // Preparation
          const stages: any = {};
          const feedAmount = ethers.utils.parseEther("100");
          const lockAmount = ethers.utils.parseEther("1");
          // Move blocktimestamp to W1 (Assuming W1 is next week)
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          await grassHouse.checkpointToken();

          // 2. Alice lock ALPACA at [W1 + 1 day]
          await timeHelpers.increaseTimestamp(DAY);
          let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(YEAR));
          let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          // Expect that Alice's ALPACA get locked and she has xALPACA balance
          expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
          expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

          // 3. Move timestamp to W2
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
          stages["oneWeekAfterAliceLock"] = [
            await timeHelpers.latestTimestamp(),
            await timeHelpers.latestBlockNumber(),
          ];
          await grassHouse.checkpointToken();
          await ALPACA.transfer(grassHouse.address, feedAmount);
          await grassHouse.checkpointToken();
          await grassHouse.setCanCheckpointToken(true);
          // The following states are expected:
          // - balanceOf GrassHouse should be feedAmount + initAmount
          // - floorWeek(lastTokenTimestamp) should be floor of current timestamp (W2)
          expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount);
          expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
            (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
          );
          // Alice try to claim rewards, expect that she shouldn't get anything
          // as she hasn't stay for a full week yet
          expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(0);

          // 5. Move timestamp to W3
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 6. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          await grassHouse.checkpointTotalSupply();
          const aliceRewards = await calExpectedRewardsAtTimestamp(
            grassHouse,
            aliceAddress,
            stages["oneWeekAfterAliceLock"][0]
          );
          expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
          // perform actual claim
          aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await grassHouse.claim(aliceAddress);
          aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
        });
      });

      context("when deployer feed rewards continuosly", async () => {
        it("should distribute W2 rewards to Alice given Alice locked ALPACA at W1 + seconds", async () => {
          // Steps:
          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          // 2. Alice lock ALPACA at [W1 + 1 day]
          // 3. Move timestamp to W2
          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
          // 5. Deployer feed rewards#1
          // 6. Deployer feed rewards#2
          // 7. Deployer feed rewards#3
          // 8. Deployer feed rewards#4
          // 9. Deployer feed rewards#5
          // a. Deployer feed rewards#6
          // b. Deployer feed rewards#7
          // c. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          // d. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          // Timeline:
          //                            3
          //                            4             c
          //              1 2           5 6 7 8 9 a b d
          //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
          //              W1            W2            W3

          // Preparation
          const stages: any = {};
          const feedAmount = ethers.utils.parseEther("100");
          const lockAmount = ethers.utils.parseEther("1");
          await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
          // Move blocktimestamp to W1 (Assuming W1 is next week)
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          await grassHouse.checkpointToken();

          // 2. Alice lock ALPACA at [W1 + 1 day]
          await timeHelpers.increaseTimestamp(DAY);
          let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(YEAR));
          let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          // Expect that Alice's ALPACA get locked and she has xALPACA balance
          expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
          expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

          // 3. Move timestamp to W2
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
          stages["oneWeekAfterAliceLock"] = [
            await timeHelpers.latestTimestamp(),
            await timeHelpers.latestBlockNumber(),
          ];
          await grassHouse.checkpointToken();
          await grassHouse.setCanCheckpointToken(true);

          // 5-b.
          for (let i = 0; i < 7; i++) {
            await grassHouse.feed(feedAmount);
            expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
            expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
              (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
            );
            await timeHelpers.increaseTimestamp(DAY);
          }

          // c. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

          // d. Alice should get some rewardTokens as she locked ALPACA before the start of the next week
          await grassHouse.checkpointTotalSupply();
          const aliceRewards = await calExpectedRewardsAtTimestamp(
            grassHouse,
            aliceAddress,
            stages["oneWeekAfterAliceLock"][0]
          );
          expect(aliceRewards).to.be.gt(0);
          expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
          // perform actual claim
          aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await grassHouse.claim(aliceAddress);
          aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
        });
      });

      context("when xALPACA breaker is on and Alice withdraw after rewards assign to W2", async () => {
        it("should distribute W2 rewards to Alice on W3 as she does eligible for the reward", async () => {
          // Steps:
          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          // 2. Alice lock ALPACA at [W1 + 1 day]
          // 3. Move timestamp to W2
          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
          // 5. Deployer feed rewards#1
          // 6. Deployer feed rewards#2
          // 7. Deployer feed rewards#3
          // 8. Deployer swith breaker to on
          // 9. Deployer feed rewards#4
          // a. Deployer feed rewards#5
          // b. Alice withdraw from xALPACA
          // c. Deployer feed rewards#6
          // d. Deployer feed rewards#7
          // e. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          // f. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          // Timeline:
          //                            3
          //                            4     8   b
          //              1 2           5 6 7 9 a c d e f
          //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
          //              W1            W2            W3

          // Preparation
          const stages: any = {};
          const feedAmount = ethers.utils.parseEther("100");
          const lockAmount = ethers.utils.parseEther("1");
          await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
          // Move blocktimestamp to W1 (Assuming W1 is next week)
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          await grassHouse.checkpointToken();

          // 2. Alice lock ALPACA at [W1 + 1 day]
          await timeHelpers.increaseTimestamp(DAY);
          let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(YEAR));
          let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          // Expect that Alice's ALPACA get locked and she has xALPACA balance
          expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
          expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

          // 3. Move timestamp to W2
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
          stages["oneWeekAfterAliceLock"] = [
            await timeHelpers.latestTimestamp(),
            await timeHelpers.latestBlockNumber(),
          ];
          await grassHouse.checkpointToken();
          await grassHouse.setCanCheckpointToken(true);

          // 5-d.
          for (let i = 0; i < 7; i++) {
            await grassHouse.feed(feedAmount);
            expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
            expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
              (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
            );

            // 8. Deployer swith breaker to on
            if (i == 3) await xALPACA.setBreaker(1);
            // b. Alice withdraw from xALPACA
            if (i == 5) {
              let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
              await xALPACAasAlice.withdraw();
              let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
              expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(lockAmount);
              expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq(0);
            }

            await timeHelpers.increaseTimestamp(DAY);
          }

          // e. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

          // f. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          await timeHelpers.increaseTimestamp(timeHelpers.DAY);
          await grassHouse.checkpointTotalSupply();
          const aliceRewards = await calExpectedRewardsAtTimestamp(
            grassHouse,
            aliceAddress,
            stages["oneWeekAfterAliceLock"][0]
          );
          expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
          // perform actual claim
          aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await grassHouse.claim(aliceAddress);
          aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
        });
      });

      context("when xALPACA breaker is on and Alice withdraw before rewards assign to W2", async () => {
        it("should NOT distribute W2 rewards to Alice at all", async () => {
          // Steps:
          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          // 2. Alice lock ALPACA at [W1 + 1 day]
          // 3. Deployer swith breaker to on
          // 4. Alice withdraw from xALPACA
          // 5. Move timestamp to W2
          // 6. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
          // 7. Deployer feed rewards#1
          // 8. Deployer feed rewards#2
          // 9. Deployer feed rewards#3
          // a. Deployer feed rewards#4
          // b. Deployer feed rewards#5
          // c. Deployer feed rewards#6
          // d. Deployer feed rewards#7
          // e. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          // f. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          // Timeline:
          //                            5
          //                    3       6             e
          //              1 2   4       7 8 9 a b c d f
          //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ▶ Time (DAY)
          //              W1            W2            W3

          // Preparation
          const stages: any = {};
          const feedAmount = ethers.utils.parseEther("100");
          const lockAmount = ethers.utils.parseEther("1");
          await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
          // Move blocktimestamp to W1 (Assuming W1 is next week)
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
          await grassHouse.checkpointToken();

          // 2. Alice lock ALPACA at [W1 + 1 day]
          await timeHelpers.increaseTimestamp(DAY);
          let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(YEAR));
          let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          // Expect that Alice's ALPACA get locked and she has xALPACA balance
          expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
          expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

          // 3. Deployer swith breaker to on
          await xALPACA.setBreaker(1);

          // 4. Alice withdraw from xALPACA
          aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
          await xALPACAasAlice.withdraw();
          aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
          // Expect that Alice get lockAmount ALPACA back and her xALPACA gone
          expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(lockAmount);
          expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq(0);

          // 5. Move timestamp to W2
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // 6. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
          // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
          // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
          stages["oneWeekAfterAliceLock"] = [
            await timeHelpers.latestTimestamp(),
            await timeHelpers.latestBlockNumber(),
          ];
          await grassHouse.checkpointToken();
          await grassHouse.setCanCheckpointToken(true);

          // 7-d.
          for (let i = 0; i < 7; i++) {
            await grassHouse.feed(feedAmount);
            expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
            expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
              (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
            );

            await timeHelpers.increaseTimestamp(DAY);
          }

          // e. At this point, we are already at W3. Increase timestamp by 1 hour
          // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
          await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

          // f. Alice should get rewards on W2-W3 window at W3 as she locked ALPACA at W1 + seconds
          await grassHouse.checkpointTotalSupply();
          const aliceRewards = await calExpectedRewardsAtTimestamp(
            grassHouse,
            aliceAddress,
            stages["oneWeekAfterAliceLock"][0]
          );
          expect(aliceRewards).to.be.eq(0);
          expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
          expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(7));
        });
      });
    });

    context("when Alice and Bob lock ALPACA", async () => {
      context("when both Bob and Alice just lock without alter it", async () => {
        context("when deployer feed rewards continuosly", async () => {
          it("should distribute W2 rewards to Alice and Bob proportionally", async () => {
            // Steps:
            // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
            // 2. Alice and Bob lock ALPACA at [W1 + 1 day]
            // 3. Move timestamp to W2
            // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
            // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
            // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
            // 5. Deployer feed rewards#1
            // 6. Deployer feed rewards#2
            // 7. Deployer feed rewards#3
            // 8. Deployer feed rewards#4
            // 9. Deployer feed rewards#5
            // a. Deployer feed rewards#6
            // b. Deployer feed rewards#7
            // c. At this point, we are already at W3. Increase timestamp by 1 hour
            // as we are already at W3 to make it pass from
            // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally
            // Timeline:
            //                            3
            //                            4             c
            //              1 2           5 6 7 8 9 a b d
            //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
            //              W1            W2            W3

            // Preparation
            const stages: any = {};
            const feedAmount = ethers.utils.parseEther("100");
            const lockAmount = ethers.utils.parseEther("1000");
            await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
            // Move blocktimestamp to W1 (Assuming W1 is next week)
            await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

            // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
            await grassHouse.checkpointToken();

            // 2. Alice and Bob lock ALPACA at [W1 + 1 day]
            await timeHelpers.increaseTimestamp(DAY);
            let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
            await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(3)));
            let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
            // Expect that Alice's ALPACA get locked and she has xALPACA balance
            expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
            expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

            let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
            await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(2)));
            let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
            // Expect that Bob's ALPACA get locked and he has xALPACA balance
            expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
            expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

            // 3. Move timestamp to W2
            await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

            // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
            // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
            // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
            stages["oneWeekAfterLock"] = [await timeHelpers.latestTimestamp(), await timeHelpers.latestBlockNumber()];
            await grassHouse.checkpointToken();
            await grassHouse.setCanCheckpointToken(true);

            // Steps 5-b
            for (let i = 0; i < 7; i++) {
              await grassHouse.feed(feedAmount);
              expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
              expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
                (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
              );
              await timeHelpers.increaseTimestamp(DAY);
            }

            // c. At this point, we are already at W3. Increase timestamp by 1 hour
            // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
            stages["twoWeeksAfterLock"] = [(await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)];
            await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

            // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally
            // Checkpoint totalSupply first so that totalSupplyAt got filled
            await grassHouse.checkpointTotalSupply();
            const aliceRewards = await calExpectedRewardsAtTimestamp(
              grassHouse,
              aliceAddress,
              stages["oneWeekAfterLock"][0]
            );
            const bobRewards = await calExpectedRewardsAtTimestamp(
              grassHouse,
              bobAddress,
              stages["oneWeekAfterLock"][0]
            );

            expect(aliceRewards).to.be.gt(0);
            expect(bobRewards).to.be.gt(0);
            expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
            expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

            // perform actual claim
            aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
            bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
            await grassHouse.claimMany([aliceAddress, bobAddress]);
            aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
            bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
            expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
            expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);
          });
        });
      });

      context("when they alter their lock", async () => {
        context("when one of them increase his unlock time", async () => {
          context("when they claim reward every week", async () => {
            context("when deployer feed rewards continuosly", async () => {
              it("should distribute rewards to Alice and Bob proportionally", async () => {
                // Steps:
                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                // 3. Move timestamp to W2
                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
                // 5. Deployer feed rewards#1 for W2
                // 6. Deployer feed rewards#2 for W2
                // 7. Deployer feed rewards#3 for W2
                // 8. Deployer feed rewards#4 for W2
                // 9. Alice increase her lock
                // a. Deployer feed rewards#5 for W2
                // b. Deployer feed rewards#6 for W2
                // c. Deployer feed rewards#7 for W2
                // d. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                // e. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50)
                // f. Deployer feed rewards#8 for W3
                // g. Move timestamp to W4
                // h. Alice should get more rewards than Bob
                // Timeline:
                //                            3
                //                            4       9     d             g
                //              1 2           5 6 7 8 a b c e f           h
                //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
                //              W1            W2            W3            W4

                // Preparation
                const stages: any = {};
                const feedAmount = ethers.utils.parseEther("100");
                const lockAmount = ethers.utils.parseEther("1000");
                await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
                // Move blocktimestamp to W1 (Assuming W1 is next week)
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                await grassHouse.checkpointToken();

                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                await timeHelpers.increaseTimestamp(DAY);
                let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                // Expect that Alice's ALPACA get locked and she has xALPACA balance
                expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

                let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                // Expect that Bob's ALPACA get locked and he has xALPACA balance
                expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

                // 3. Move timestamp to W2
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
                stages["oneWeekAfterLock"] = [
                  await timeHelpers.latestTimestamp(),
                  await timeHelpers.latestBlockNumber(),
                ];
                await grassHouse.checkpointToken();
                await grassHouse.setCanCheckpointToken(true);

                // Steps 5-c
                for (let i = 0; i < 7; i++) {
                  await grassHouse.feed(feedAmount);
                  expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
                  expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
                    (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
                  );

                  // 9. Alice increase her lock
                  if (i == 4) {
                    await xALPACAasAlice.increaseUnlockTime((await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                  }

                  await timeHelpers.increaseTimestamp(DAY);
                }

                // d. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                stages["twoWeeksAfterLock"] = [(await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)];
                await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

                // e. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50)
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                let aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["oneWeekAfterLock"][0]
                );
                let bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["oneWeekAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);

                // f. Deployer feed rewards#8 for W3
                await timeHelpers.increaseTimestamp(DAY);
                await grassHouse.feed(feedAmount);

                expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount);
                expect(await grassHouse.tokensPerWeek(stages["twoWeeksAfterLock"][0])).to.be.eq(feedAmount);

                // g. Move timestamp to W4
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // h. Alice should get more rewards than Bob
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["twoWeeksAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                expect(aliceRewards).to.be.gt(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);
              });
            });
          });

          context("when Alice not claim reward but Bob does", async () => {
            context("when deployer feed rewards continuosly", async () => {
              it("should distribute rollover Alice's rewards", async () => {
                // Steps:
                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                // 3. Move timestamp to W2
                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
                // 5. Deployer feed rewards#1 for W2
                // 6. Deployer feed rewards#2 for W2
                // 7. Deployer feed rewards#3 for W2
                // 8. Deployer feed rewards#4 for W2
                // 9. Alice increase her lock
                // a. Deployer feed rewards#5 for W2
                // b. Deployer feed rewards#6 for W2
                // c. Deployer feed rewards#7 for W2
                // d. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                // e. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50),
                // however only Bob claim the rewards.
                // f. Deployer feed rewards#8 for W3
                // g. Move timestamp to W4
                // h. Alice should get more rewards than Bob and Alice should be able to claim
                // W2-W3 rewards + W3-W4 rewards
                // Timeline:
                //                           3         9   c             f
                //             1 2           4 5 6 7 8 a b d e           g
                // ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
                //             W1            W2            W3            W4

                // Preparation
                const stages: any = {};
                const feedAmount = ethers.utils.parseEther("100");
                const lockAmount = ethers.utils.parseEther("1000");
                await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
                // Move blocktimestamp to W1 (Assuming W1 is next week)
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                await grassHouse.checkpointToken();

                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                await timeHelpers.increaseTimestamp(DAY);
                let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                // Expect that Alice's ALPACA get locked and she has xALPACA balance
                expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

                let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                // Expect that Bob's ALPACA get locked and he has xALPACA balance
                expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

                // 3. Move timestamp to W2
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
                stages["oneWeekAfterLock"] = [
                  await timeHelpers.latestTimestamp(),
                  await timeHelpers.latestBlockNumber(),
                ];
                await grassHouse.checkpointToken();
                await grassHouse.setCanCheckpointToken(true);

                // Steps 5-c
                for (let i = 0; i < 7; i++) {
                  await grassHouse.feed(feedAmount);
                  expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
                  expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
                    (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
                  );

                  // 9. Alice increase her lock
                  if (i == 4) {
                    await xALPACAasAlice.increaseUnlockTime((await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                  }

                  await timeHelpers.increaseTimestamp(DAY);
                }

                // d. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                stages["twoWeeksAfterLock"] = [(await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)];
                await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

                // e. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50),
                // however only Bob claim the rewards.
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                let aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["oneWeekAfterLock"][0]
                );
                let bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["oneWeekAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim. Only Bob does that.
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([bobAddress]);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);

                // f. Deployer feed rewards#8 for W3
                await timeHelpers.increaseTimestamp(DAY);
                await grassHouse.feed(feedAmount);

                // Expect that grassHouse has feedAmount + aliceExpectedRewards due to Alice not claim her portion
                expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.add(aliceRewards));
                // Expect that W3-W4 rewards get allocated correctly
                expect(await grassHouse.tokensPerWeek(stages["twoWeeksAfterLock"][0])).to.be.eq(feedAmount);

                // g. Move timestamp to W4
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // h. Alice should get more rewards than Bob and Alice should be able to claim
                // W2-W3 rewards + W3-W4 rewards
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                const aliceW2W3reward = aliceRewards;
                aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                // Alice's rewards must rollover to the next week
                aliceRewards = aliceW2W3reward.add(aliceRewards);

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(aliceRewards.sub(aliceW2W3reward)).to.be.gt(bobRewards);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);
              });
            });
          });
        });

        context("when one of them increase his deposit amount", async () => {
          context("when they claim reward every week", async () => {
            context("when deployer feed rewards continuosly", async () => {
              it("should distribute rewards to Alice and Bob proportionally", async () => {
                // Steps:
                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                // 3. Move timestamp to W2
                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
                // 5. Deployer feed rewards#1 for W2
                // 6. Deployer feed rewards#2 for W2
                // 7. Deployer feed rewards#3 for W2
                // 8. Deployer feed rewards#4 for W2
                // 9. Alice increase her amount
                // a. Deployer feed rewards#5 for W2
                // b. Deployer feed rewards#6 for W2
                // c. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50)
                // e. Deployer feed rewards#7 for W3
                // f. Move timestamp to W4
                // g. Alice should get more rewards than Bob
                // Timeline:
                //                           3         9   c             f
                //             1 2           4 5 6 7 8 a b d e           g
                // ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
                //             W1            W2            W3            W4

                // Preparation
                const stages: any = {};
                const feedAmount = ethers.utils.parseEther("100");
                const lockAmount = ethers.utils.parseEther("1000");
                await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
                // Move blocktimestamp to W1 (Assuming W1 is next week)
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                await grassHouse.checkpointToken();

                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                await timeHelpers.increaseTimestamp(DAY);
                let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                // Expect that Alice's ALPACA get locked and she has xALPACA balance
                expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

                let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                // Expect that Bob's ALPACA get locked and he has xALPACA balance
                expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

                // 3. Move timestamp to W2
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
                stages["oneWeekAfterLock"] = [
                  await timeHelpers.latestTimestamp(),
                  await timeHelpers.latestBlockNumber(),
                ];
                await grassHouse.checkpointToken();
                await grassHouse.setCanCheckpointToken(true);

                // Steps 5-b
                for (let i = 0; i < 7; i++) {
                  await grassHouse.feed(feedAmount);
                  expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
                  expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
                    (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
                  );

                  // 9. Alice increase her lock
                  if (i == 4) {
                    await xALPACAasAlice.increaseLockAmount(lockAmount);
                  }

                  await timeHelpers.increaseTimestamp(DAY);
                }

                // c. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                stages["twoWeeksAfterLock"] = [(await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)];
                await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

                // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50)
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                let aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["oneWeekAfterLock"][0]
                );
                let bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["oneWeekAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);

                // e. Deployer feed rewards#7 for W3
                await timeHelpers.increaseTimestamp(DAY);
                await grassHouse.feed(feedAmount);

                expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount);
                expect(await grassHouse.tokensPerWeek(stages["twoWeeksAfterLock"][0])).to.be.eq(feedAmount);

                // f. Move timestamp to W4
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // g. Alice should get more rewards than Bob
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["twoWeeksAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(aliceRewards).to.be.gt(bobRewards);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);
              });
            });
          });

          context("when Alice not claim reward but Bob does", async () => {
            context("when deployer feed rewards continuosly", async () => {
              it("should distribute rollover Alice's rewards", async () => {
                // Steps:
                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                // 3. Move timestamp to W2
                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
                // 5. Deployer feed rewards#1 for W2
                // 6. Deployer feed rewards#2 for W2
                // 7. Deployer feed rewards#3 for W2
                // 8. Deployer feed rewards#4 for W2
                // 9. Alice increase her lock amount
                // a. Deployer feed rewards#5 for W2
                // b. Deployer feed rewards#6 for W2
                // c. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50),
                // however only Bob claim the rewards.
                // e. Deployer feed rewards#7 for W3
                // f. Move timestamp to W4
                // g. Alice should get more rewards than Bob and Alice should be able to claim
                // W2-W3 rewards + W3-W4 rewards
                // Timeline:
                //                           3         9   c             f
                //             1 2           4 5 6 7 8 a b d e           g
                // ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ─▶ Time (DAY)
                //             W1            W2            W3            W4

                // Preparation
                const stages: any = {};
                const feedAmount = ethers.utils.parseEther("100");
                const lockAmount = ethers.utils.parseEther("1000");
                await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
                // Move blocktimestamp to W1 (Assuming W1 is next week)
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
                await grassHouse.checkpointToken();

                // 2. Alice and Bob lock ALPACA at [W1 + 1 day] with the same amount conditions
                await timeHelpers.increaseTimestamp(DAY);
                let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                // Expect that Alice's ALPACA get locked and she has xALPACA balance
                expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

                let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
                let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                // Expect that Bob's ALPACA get locked and he has xALPACA balance
                expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
                expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

                // 3. Move timestamp to W2
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // 4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
                // Then deployer transfer rewards directly to GrassHouse and call checkpoint to perform the actual reward allocation.
                // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken
                stages["oneWeekAfterLock"] = [
                  await timeHelpers.latestTimestamp(),
                  await timeHelpers.latestBlockNumber(),
                ];
                await grassHouse.checkpointToken();
                await grassHouse.setCanCheckpointToken(true);

                // Steps 5-b
                for (let i = 0; i < 7; i++) {
                  await grassHouse.feed(feedAmount);
                  expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
                  expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
                    (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
                  );

                  // 9. Alice increase her lock
                  if (i == 4) {
                    await xALPACAasAlice.increaseLockAmount(lockAmount);
                  }

                  await timeHelpers.increaseTimestamp(DAY);
                }

                // c. At this point, we are already at W3. Increase timestamp by 1 hour
                // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
                stages["twoWeeksAfterLock"] = [(await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)];
                await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

                // d. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally (50-50),
                // however only Bob claim the rewards.
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                let aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["oneWeekAfterLock"][0]
                );
                let bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["oneWeekAfterLock"][0]
                );

                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim. Only Bob does that.
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([bobAddress]);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);

                // e. Deployer feed rewards#7 for W3
                await timeHelpers.increaseTimestamp(DAY);
                await grassHouse.feed(feedAmount);

                // Expect that grassHouse has feedAmount + aliceExpectedRewards due to Alice not claim her portion
                expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.add(aliceRewards));
                // Expect that W3-W4 rewards get allocated correctly
                expect(await grassHouse.tokensPerWeek(stages["twoWeeksAfterLock"][0])).to.be.eq(feedAmount);

                // f. Move timestamp to W4
                await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

                // g. Alice should get more rewards than Bob and Alice should be able to claim
                // W2-W3 rewards + W3-W4 rewards
                // Checkpoint totalSupply first so that totalSupplyAt got filled
                await grassHouse.checkpointTotalSupply();
                const aliceW2W3reward = aliceRewards;
                aliceRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  aliceAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                bobRewards = await calExpectedRewardsAtTimestamp(
                  grassHouse,
                  bobAddress,
                  stages["twoWeeksAfterLock"][0]
                );
                // Alice's rewards must rollover to the next week
                aliceRewards = aliceW2W3reward.add(aliceRewards);

                expect(aliceRewards.sub(aliceW2W3reward)).to.be.gt(bobRewards);
                expect(aliceRewards).to.be.gt(0);
                expect(bobRewards).to.be.gt(0);
                expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
                expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobRewards);

                // perform actual claim
                aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
                await grassHouse.claimMany([aliceAddress, bobAddress]);
                aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
                bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
                expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceRewards);
                expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobRewards);
              });
            });
          });
        });
      });
    });

    context("when there are multiple GrassHouses", async () => {
      it("should allow Alice and Bob claim rewards from multiple GrassHouse", async () => {
        // Steps:
        // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
        // 2. Alice and Bob lock ALPACA at [W1 + 1 day]
        // 3. Move timestamp to W2
        // 4. Deployer deploy DTOKEN GrassHouse
        // 5. [DTOKEN GrassHouse] Deployer transfer rewards directly and call checkpoint to perform
        // the actual DTOKEN allocation for W2, do this week to force checkpointToken.
        // Then deployer enable canCheckpointToken.
        // 6. [ALPACA GrassHouse] Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
        // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
        // 7. [ALPACA GrassHouse] Deployer feed rewards#1
        // 8. [ALPACA GrassHouse] Deployer feed rewards#2
        // 9. [ALPACA GrassHouse] Deployer feed rewards#3
        // a. [ALPACA GrassHouse] Deployer feed rewards#4
        // b. [ALPACA GrassHouse] Deployer feed rewards#5
        // c. [ALPACA GrassHouse] Deployer feed rewards#6
        // d. [ALPACA GrassHouse] Deployer feed rewards#7
        // e. At this point, we are already at W3. Increase timestamp by 1 hour
        // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
        // f. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally from both DTOKEN GrassHouse and ALPACA GrassHouse
        // Timeline:
        //                            3
        //                            4
        //                            5
        //                            6             e
        //              1 2           7 8 9 a b c d f
        //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─▶ Time (DAY)
        //              W1            W2            W3

        // Preparation
        const stages: any = {};
        const feedAmount = ethers.utils.parseEther("100");
        const lockAmount = ethers.utils.parseEther("1000");
        await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
        // Move blocktimestamp to W1 (Assuming W1 is next week)
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // 1. Deployer call checkpointToken to move lastTokenTimestamp to W1.
        await grassHouse.checkpointToken();

        // 2. Alice and Bob lock ALPACA at [W1 + 1 day]
        await timeHelpers.increaseTimestamp(DAY);
        let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(3)));
        let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
        // Expect that Alice's ALPACA get locked and she has xALPACA balance
        expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

        let bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
        await xALPACAasBob.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(2)));
        let bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
        // Expect that Bob's ALPACA get locked and he has xALPACA balance
        expect(bobAlpacaBefore.sub(bobAlpacaAfter)).to.be.eq(lockAmount);
        expect(await xALPACA.balanceOf(bobAddress)).to.be.gt(0);

        // 3. Move timestamp to W2
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Snapshot block.timestamp and block.number of one week after lock
        stages["oneWeekAfterLock"] = [await timeHelpers.latestTimestamp(), await timeHelpers.latestBlockNumber()];

        // 4. Deployer deploy DTOKEN GrassHouse
        const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
        const dTokenGrassHouse = (await upgrades.deployProxy(GrassHouse, [
          xALPACA.address,
          await timeHelpers.latestTimestamp(),
          DTOKEN.address,
          deployerAddress,
        ])) as GrassHouse;
        await dTokenGrassHouse.deployed();

        await DTOKEN.approve(dTokenGrassHouse.address, ethers.constants.MaxUint256);

        // 5. [DTOKEN GrassHouse] Deployer transfer rewards directly and call checkpoint to perform
        // the actual DTOKEN allocation for W2. Then deployer enable canCheckpointToken.
        await DTOKEN.transfer(dTokenGrassHouse.address, feedAmount);
        await dTokenGrassHouse.checkpointToken();
        await dTokenGrassHouse.setCanCheckpointToken(true);

        // 6. [ALPACA GrassHouse] Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only
        // At this point user can call checkpointToken, hence Deployer enable canCheckpointToken.
        await grassHouse.checkpointToken();
        await grassHouse.setCanCheckpointToken(true);

        // Steps 7-d
        for (let i = 0; i < 7; i++) {
          await grassHouse.feed(feedAmount);
          expect(await ALPACA.balanceOf(grassHouse.address)).to.be.eq(feedAmount.mul(i + 1));
          expect((await grassHouse.lastTokenTimestamp()).div(WEEK).mul(WEEK)).to.be.eq(
            (await timeHelpers.latestTimestamp()).div(WEEK).mul(WEEK)
          );
          await timeHelpers.increaseTimestamp(DAY);
        }

        // e. At this point, we are already at W3. Increase timestamp by 1 hour
        // as we are already at W3 to make it pass from TOKEN_CHECKPOINT_DEADLINE
        await timeHelpers.increaseTimestamp(timeHelpers.HOUR);

        // f. Alice and Bob should get rewards on W2-W3 window at W3 porprotionally
        // Checkpoint totalSupply first so that totalSupplyAt got filled
        await grassHouse.checkpointTotalSupply();
        await dTokenGrassHouse.checkpointTotalSupply();
        // ALPACA GrassHouse
        const aliceAlpacaGrassHouseRewards = await calExpectedRewardsAtTimestamp(
          grassHouse,
          aliceAddress,
          stages["oneWeekAfterLock"][0]
        );
        const bobAlpacaGrassHouseRewards = await calExpectedRewardsAtTimestamp(
          grassHouse,
          bobAddress,
          stages["oneWeekAfterLock"][0]
        );

        expect(aliceAlpacaGrassHouseRewards).to.be.gt(0);
        expect(bobAlpacaGrassHouseRewards).to.be.gt(0);
        expect(await grassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceAlpacaGrassHouseRewards);
        expect(await grassHouse.callStatic.claim(bobAddress)).to.be.eq(bobAlpacaGrassHouseRewards);

        // perform actual claim
        aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
        bobAlpacaBefore = await ALPACA.balanceOf(bobAddress);
        await grassHouse.claimMany([aliceAddress, bobAddress]);
        aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
        bobAlpacaAfter = await ALPACA.balanceOf(bobAddress);
        expect(aliceAlpacaAfter.sub(aliceAlpacaBefore)).to.be.eq(aliceAlpacaGrassHouseRewards);
        expect(bobAlpacaAfter.sub(bobAlpacaBefore)).to.be.eq(bobAlpacaGrassHouseRewards);

        // DTOKEN GrassHouse
        expect(await dTokenGrassHouse.tokensPerWeek(stages["oneWeekAfterLock"][0])).to.be.eq(feedAmount);
        const aliceDtokenGrassHouseRewards = await calExpectedRewardsAtTimestamp(
          dTokenGrassHouse,
          aliceAddress,
          stages["oneWeekAfterLock"][0]
        );
        const bobDtokenGrassHouseRewards = await calExpectedRewardsAtTimestamp(
          dTokenGrassHouse,
          bobAddress,
          stages["oneWeekAfterLock"][0]
        );

        expect(aliceDtokenGrassHouseRewards).to.be.gt(0);
        expect(bobDtokenGrassHouseRewards).to.be.gt(0);
        expect(await dTokenGrassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceDtokenGrassHouseRewards);
        expect(await dTokenGrassHouse.callStatic.claim(bobAddress)).to.be.eq(bobDtokenGrassHouseRewards);
      });
    });

    context("when grass house deploy after xALPACA for weeks", async () => {
      it("should handle reward distribution properly", async () => {
        // Steps:
        // 1. Alice lock ALPACA at [W1 + 1 day]
        // 2. Deployer deploy DTOKEN GrassHouse
        // 3. Deployer feed DTOKEN
        // 4. Alice claim DTOKEN. Expected to get rewards during W3-W4 only.
        // Timeline
        //                                          2
        //                1                         3             4
        //  ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─▶ Time (DAY)
        //              W1            W2            W3            W4
        // Preparation
        const stages: any = {};
        const feedAmount = ethers.utils.parseEther("100");
        const lockAmount = ethers.utils.parseEther("1000");
        await ALPACA.approve(grassHouse.address, ethers.constants.MaxUint256);
        // Move blocktimestamp to W1 (Assuming W1 is next week)
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // 1. Alice lock ALPACA at [W1 + 1 day]
        await timeHelpers.increaseTimestamp(DAY);
        let aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(8)));
        let aliceAlpacaAfter = await ALPACA.balanceOf(aliceAddress);
        // Expect that Alice's ALPACA get locked and she has xALPACA balance
        expect(aliceAlpacaBefore.sub(aliceAlpacaAfter)).to.be.eq(lockAmount);
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.gt(0);

        // 2. Deployer deploy DTOKEN GrassHouse
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(2).mul(WEEK));
        stages["dTokenGrassHouseDeployed"] = [
          await timeHelpers.latestTimestamp(),
          await timeHelpers.latestBlockNumber(),
        ];
        const GrassHouse = (await ethers.getContractFactory("GrassHouse")) as GrassHouse__factory;
        const dTokenGrassHouse = (await upgrades.deployProxy(GrassHouse, [
          xALPACA.address,
          await timeHelpers.latestTimestamp(),
          DTOKEN.address,
          deployerAddress,
        ])) as GrassHouse;
        await dTokenGrassHouse.deployed();

        // 3. Deployer feed DTOKEN
        await DTOKEN.transfer(dTokenGrassHouse.address, feedAmount);
        await dTokenGrassHouse.checkpointToken();
        await dTokenGrassHouse.setCanCheckpointToken(true);

        // 4. Alice claim DTOKEN. Expected to get rewards during W3-W4 only.
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));
        await dTokenGrassHouse.checkpointTotalSupply();
        const aliceRewards = await calExpectedRewardsAtTimestamp(
          dTokenGrassHouse,
          aliceAddress,
          stages["dTokenGrassHouseDeployed"][0]
        );
        expect(aliceRewards).to.be.eq(feedAmount);
        expect(await dTokenGrassHouse.callStatic.claim(aliceAddress)).to.be.eq(aliceRewards);
      });
    });
  });
});
