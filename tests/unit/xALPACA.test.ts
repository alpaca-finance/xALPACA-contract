import { ethers, waffle, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BEP20,
  BEP20__factory,
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

describe("xALPACA", () => {
  const TOLERANCE = "0.04"; // 0.04%
  const HOUR = ethers.BigNumber.from(3600);
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);
  const MAX_LOCK = ethers.BigNumber.from(32054399); // seconds in 53 weeks - 1 second (60 * 60 * 24 * 7 * 53) - 1

  // Contact Instance
  let ALPACA: BEP20;
  let xALPACA: XALPACA;

  let contractContext: MockContractContext;
  let whitelistedContract: MockContractContext

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

    // Deploy contract context
    const MockContractContext = (await ethers.getContractFactory(
      "MockContractContext",
      deployer
    )) as MockContractContext__factory;
    contractContext = await MockContractContext.deploy();
    await contractContext.deployed();

    whitelistedContract = await MockContractContext.deploy();
    await whitelistedContract.deployed();


    // Deploy ALPACA
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    ALPACA = await BEP20.deploy("ALPACA", "ALPACA");
    await ALPACA.mint(deployerAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(aliceAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(bobAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(eveAddress, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(contractContext.address, ethers.utils.parseEther("8888888"));
    await ALPACA.mint(whitelistedContract.address, ethers.utils.parseEther("8888888"));
    // Deploy xALPACA
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xALPACA = (await upgrades.deployProxy(XALPACA, [ALPACA.address])) as XALPACA;
    await xALPACA.deployed();

    // Approve xALPACA to transferFrom contractContext
    await contractContext.executeTransaction(
      ALPACA.address,
      0,
      "approve(address,uint256)",
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [xALPACA.address, ethers.constants.MaxUint256])
    );

    await xALPACA.setWhitelistedCallers([whitelistedContract.address],true)

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

  describe("#balanceOfAt", async () => {
    context("when _blockNumber > block.number", async () => {
      it("should revert", async () => {
        await expect(
          xALPACA.balanceOfAt(aliceAddress, (await timeHelpers.latestBlockNumber()).add(1))
        ).to.be.revertedWith("bad _blockNumber");
      });
    });

    context("when balanceOfAt(user, expiredBlock)", async () => {
      it("should return 0", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Move timestamp to 1 week and 1 second
        await timeHelpers.increaseTimestamp(WEEK.add(1));

        expect(await xALPACA.balanceOfAt(aliceAddress, await timeHelpers.latestBlockNumber())).to.be.eq("0");
      });
    });
  });

  describe("#createLock", async () => {
    context("when try to lock 0 ALPACA", async () => {
      it("should revert", async () => {
        await expect(
          xALPACAasAlice.createLock("0", (await timeHelpers.latestTimestamp()).add(WEEK))
        ).to.be.revertedWith("bad amount");
      });
    });

    context("when try to lock to the past", async () => {
      it("should revert", async () => {
        await expect(xALPACA.createLock("1", "1")).to.be.revertedWith("can only lock until future");
      });
    });

    context("when try to lock beyond MAX_LOCK", async () => {
      it("should revert", async () => {
        await expect(
          xALPACA.createLock("1", (await timeHelpers.latestTimestamp()).add(MAX_LOCK.add(WEEK)))
        ).to.be.revertedWith("can only lock 1 year max");
      });
    });

    context("when invalid contract call", async () => {
      it("should revert", async () => {
        await expect(
          contractContext.executeTransaction(
            xALPACA.address,
            "0",
            "createLock(uint256,uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], ["1", "1"])
          )
        ).to.be.revertedWith("not eoa");
      });
    });

    context("when whitelisted contract call", async () => {
      it("should be able to create lock", async () => {
        const amount = ethers.utils.parseEther("10")
        await whitelistedContract.executeTransaction(
          ALPACA.address,
          "0",
          "approve(address,uint256)",
          ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [xALPACA.address, ethers.utils.parseEther("10")])
        );

        const lock = (await timeHelpers.latestTimestamp()).add(WEEK.mul(10))

        await 
          whitelistedContract.executeTransaction(
            xALPACA.address,
            "0",
            "createLock(uint256,uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [amount, lock])
          )

         const [lockedAmount,unlockTime] = await xALPACA["locks(address)"](whitelistedContract.address)

          expect(lockedAmount).to.be.eq(amount)
          expect(lock).gte(unlockTime)
      });
    });

    context("when user already lock", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("1000");
        // Set block timestamp to starting of next week UTC
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice locked for MAX_LOCK
        const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(MAX_LOCK);
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
        await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);

        await expect(xALPACAasAlice.createLock(lockAmount, aliceLockEnd.add(WEEK))).to.be.revertedWith("already lock");
      });
    });

    context("when user lock MAX_LOCK", async () => {
      it("should work", async () => {
        const lockAmount = ethers.utils.parseEther("1000");
        // Set block timestamp to starting of next week UTC
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice locked for MAX_LOCK
        const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(MAX_LOCK);
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
        await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);

        const lockedAlice = await xALPACAasAlice.locks(aliceAddress);

        assertHelpers.assertBigNumberClosePercent(await ALPACA.balanceOf(xALPACA.address), lockAmount, TOLERANCE);
        assertHelpers.assertBigNumberClosePercent(await xALPACA.supply(), lockAmount, TOLERANCE);

        expect(lockedAlice.amount).to.be.eq(lockAmount);
        expect(lockedAlice.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));

        await timeHelpers.increaseTimestamp(timeHelpers.duration.weeks(BigNumber.from("2")));
        await xALPACA.checkpoint();
      });
    });
  });

  describe("#depositFor", async () => {
    context("when _amount = 0", async () => {
      it("should revert", async () => {
        await expect(xALPACA.depositFor(aliceAddress, "0")).to.be.revertedWith("bad _amount");
      });
    });

    context("when lock not existed", async () => {
      it("should revert", async () => {
        await expect(xALPACA.depositFor(aliceAddress, "1")).to.be.revertedWith("!lock existed");
      });
    });

    context("when lock is expired", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Move timestamp to 1 week and 1 second
        await timeHelpers.increaseTimestamp(WEEK.add(1));

        // Alice try to call depositFor her lock, this should revert
        await expect(xALPACAasAlice.depositFor(aliceAddress, "1")).to.be.revertedWith("lock expired. please withdraw");
      });
    });

    context("when everything ok", async () => {
      context("when msg.sender is Bob", async () => {
        it("should work", async () => {
          const lockAmount = ethers.utils.parseEther("10");
          await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
          await ALPACAasBob.approve(xALPACA.address, ethers.constants.MaxUint256);

          // Set timestamp to the starting of next week
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // Alice create lock with expire in 1 week
          const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(WEEK);
          await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);

          // Bob deposit for Alice, this should work
          await xALPACAasBob.depositFor(aliceAddress, lockAmount);
          const aliceLock = await xALPACA.locks(aliceAddress);

          assertHelpers.assertBigNumberClosePercent(
            await xALPACA.balanceOf(aliceAddress),
            lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
            TOLERANCE
          );
          assertHelpers.assertBigNumberClosePercent(
            await xALPACA.totalSupply(),
            lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
            TOLERANCE
          );
          expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
          expect(aliceLock.amount).to.be.eq(lockAmount.add(lockAmount));
          expect(aliceLock.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));
        });
      });

      context("when msg.sender is contract", async () => {
        it("should work", async () => {
          const lockAmount = ethers.utils.parseEther("10");
          await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
          await ALPACAasBob.approve(xALPACA.address, ethers.constants.MaxUint256);

          // Set timestamp to the starting of next week
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

          // Alice create lock with expire in 1 week
          const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(WEEK);
          await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);

          // Contract deposit for Alice, this should work
          await contractContext.executeTransaction(
            xALPACA.address,
            "0",
            "depositFor(address,uint256)",
            ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [aliceAddress, lockAmount])
          );
          const aliceLock = await xALPACA.locks(aliceAddress);

          assertHelpers.assertBigNumberClosePercent(
            await xALPACA.balanceOf(aliceAddress),
            lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
            TOLERANCE
          );
          assertHelpers.assertBigNumberClosePercent(
            await xALPACA.totalSupply(),
            lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
            TOLERANCE
          );
          expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
          expect(aliceLock.amount).to.be.eq(lockAmount.add(lockAmount));
          expect(aliceLock.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));
        });
      });
    });
  });

  describe("#increaseUnlockTime", async () => {
    context("when lock is not existed", async () => {
      it("should revert", async () => {
        await expect(xALPACA.increaseUnlockTime("1")).to.be.revertedWith("!lock existed");
      });
    });

    context("when lock is expired", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Move timestamp to 1 week and 1 second
        await timeHelpers.increaseTimestamp(WEEK.add(1));

        // Alice try to increaseUnlockTime, this should revert
        await expect(xALPACAasAlice.increaseUnlockTime("1")).to.be.revertedWith("lock expired. please withdraw");
      });
    });

    context("when new unlock time before than lock.end", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Alice try to increaseUnlockTime, this should revert
        await expect(xALPACAasAlice.increaseUnlockTime("1")).to.be.revertedWith("only extend lock");
      });
    });

    context("when new unlock time after than 1 year", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Alice try to increaseUnlockTime to more than 1 year, this should revert
        await expect(
          xALPACAasAlice.increaseUnlockTime((await timeHelpers.latestTimestamp()).add(MAX_LOCK).add(WEEK))
        ).to.be.revertedWith("1 year max");
      });
    });

    context("whitelistedcontract call", async () => {
      it("should be able to increaseUnlockTime", async () => {
        const amount = ethers.utils.parseEther("10")
        await whitelistedContract.executeTransaction(
          ALPACA.address,
          "0",
          "approve(address,uint256)",
          ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [xALPACA.address, ethers.utils.parseEther("10")])
        );

        const lock = (await timeHelpers.latestTimestamp()).add(WEEK.mul(10))

        await 
          whitelistedContract.executeTransaction(
            xALPACA.address,
            "0",
            "createLock(uint256,uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [amount, lock])
          )

         const [lockedAmount,unlockTime] = await xALPACA["locks(address)"](whitelistedContract.address)
          expect(lockedAmount).to.be.eq(amount)
          expect(lock).gte(unlockTime)

          // lock more another week
        const extendUnlockTime = unlockTime.add(WEEK)
        await 
          whitelistedContract.executeTransaction(
            xALPACA.address,
            "0",
            "increaseUnlockTime(uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256"], [extendUnlockTime])
          )
          const [lockedAmountAfterExtend,unlockTimeAfterExtend] = await xALPACA["locks(address)"](whitelistedContract.address)

          expect(amount).to.be.eq(lockedAmountAfterExtend)
          expect(extendUnlockTime).to.be.eq(unlockTimeAfterExtend)      
      });
    });

    context("when invalid contract call", async () => {
      it("should revert", async () => {
        await expect(
          contractContext.executeTransaction(
            xALPACA.address,
            "0",
            "increaseUnlockTime(uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256"], ["1"])
          )
        ).to.be.revertedWith("not eoa");
      });
    });

    context("when everything is alright", async () => {
      it("should work", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(WEEK);
        await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);
        let aliceLock = await xALPACA.locks(aliceAddress);

        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.balanceOf(aliceAddress),
          lockAmount.div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.totalSupply(),
          lockAmount.div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
        expect(aliceLock.amount).to.be.eq(lockAmount);
        expect(aliceLock.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));

        // Alice increaseUnlockTime
        await xALPACAasAlice.increaseUnlockTime(aliceLockEnd.add(WEEK));

        aliceLock = await xALPACA.locks(aliceAddress);

        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.balanceOf(aliceAddress),
          lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)),
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.totalSupply(),
          lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)),
          TOLERANCE
        );
        expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
        expect(aliceLock.amount).to.be.eq(lockAmount);
        expect(aliceLock.end).to.be.eq(aliceLockEnd.add(WEEK).div(WEEK).mul(WEEK));
      });
    });
  });

  describe("#increaseLockAmount", async () => {
    context("when _amount = 0", async () => {
      it("should revert", async () => {
        await expect(xALPACA.increaseLockAmount("0")).to.be.revertedWith("bad _amount");
      });
    });

    context("when lock is not existed", async () => {
      it("should revert", async () => {
        await expect(xALPACA.increaseLockAmount("1")).to.be.revertedWith("!lock existed");
      });
    });

    context("when lock is expired", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));
        // Move timestamp to 1 week and 1 second
        await timeHelpers.increaseTimestamp(WEEK.add(1));

        // Alice try to increaseLockAmount, this should revert
        await expect(xALPACAasAlice.increaseLockAmount("1")).to.be.revertedWith("lock expired. please withdraw");
      });
    });

    context("when whitelisted contract call", async () => {
      it("should be able increaseLockAmount", async () => {
        const amount = ethers.utils.parseEther("10")
        await whitelistedContract.executeTransaction(
          ALPACA.address,
          "0",
          "approve(address,uint256)",
          ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [xALPACA.address, ethers.utils.parseEther("20")])
        );

        const lock = (await timeHelpers.latestTimestamp()).add(WEEK.mul(10))

        await 
          whitelistedContract.executeTransaction(
            xALPACA.address,
            "0",
            "createLock(uint256,uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [amount, lock])
          )

         const [lockedAmount,unlockTime] = await xALPACA["locks(address)"](whitelistedContract.address)
          expect(lockedAmount).to.be.eq(amount)
          expect(lock).gte(unlockTime)

        await 
        whitelistedContract.executeTransaction(
            xALPACA.address,
            "0",
            "increaseLockAmount(uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256"], [amount])
          )
       
          const [lockedAmountAfterExtend,unlockTimeAfterExtend] = await xALPACA["locks(address)"](whitelistedContract.address)
          expect(amount.add(amount)).to.be.eq(lockedAmountAfterExtend)
          expect(unlockTime).to.be.eq(unlockTimeAfterExtend)
      });
    });
    
    context("when invalid contract call", async () => {
      it("should revert", async () => {
        await expect(
          contractContext.executeTransaction(
            xALPACA.address,
            "0",
            "increaseLockAmount(uint256)",
            ethers.utils.defaultAbiCoder.encode(["uint256"], ["1"])
          )
        ).to.be.revertedWith("not eoa");
      });
    });

    context("when everything is alright", async () => {
      it("should work", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        const aliceLockEnd = (await timeHelpers.latestTimestamp()).add(WEEK);
        await xALPACAasAlice.createLock(lockAmount, aliceLockEnd);
        let aliceLock = await xALPACA.locks(aliceAddress);

        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.balanceOf(aliceAddress),
          lockAmount.div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.totalSupply(),
          lockAmount.div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
        expect(aliceLock.amount).to.be.eq(lockAmount);
        expect(aliceLock.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));

        // Alice increaseLockAmount
        await xALPACAasAlice.increaseLockAmount(lockAmount);

        aliceLock = await xALPACA.locks(aliceAddress);

        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.balanceOf(aliceAddress),
          lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        assertHelpers.assertBigNumberClosePercent(
          await xALPACA.totalSupply(),
          lockAmount.add(lockAmount).div(MAX_LOCK).mul(WEEK),
          TOLERANCE
        );
        expect(await xALPACA.totalSupply()).to.be.eq(await xALPACA.balanceOf(aliceAddress));
        expect(aliceLock.amount).to.be.eq(lockAmount.add(lockAmount));
        expect(aliceLock.end).to.be.eq(aliceLockEnd.div(WEEK).mul(WEEK));
      });
    });
  });

  describe("#withdraw", async () => {
    context("when lock not expired", async () => {
      it("should revert", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Alice try to withdrwa not expired lock
        await expect(xALPACAasAlice.withdraw()).to.be.revertedWith("!lock expired");
      });
    });
    context("when lock is expired", async () => {
      it("should work", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));

        // Move timestamp to 1 week + 1 second
        await timeHelpers.increaseTimestamp(WEEK.add("1"));

        // Alice try to withdrwa not expired lock
        const aliceAlpacaBefore = await ALPACA.balanceOf(aliceAddress);
        await xALPACAasAlice.withdraw();
        const aliceAlpaceAfter = await ALPACA.balanceOf(aliceAddress);

        expect(aliceAlpaceAfter.sub(aliceAlpacaBefore)).to.be.eq(lockAmount);
      });
    });
  });

  describe("#earlyWithdraw", async () => {
    context("when lock not expired and fully withdraw", async () => {
      it("should works", async () => {
        // deployer as treasury, eve as redistributor
        // 1% per remaining week penalty, 50% goes to treasury
        await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 10 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(10)));

        const alpacaAliceBefore = await ALPACA.balanceOf(aliceAddress);
        const alpacaDeployerBefore = await ALPACA.balanceOf(deployerAddress);

        // Alice early withdraw
        await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("10"));

        const alpacaAliceAfter = await ALPACA.balanceOf(aliceAddress);
        const alpacaDeployerAfter = await ALPACA.balanceOf(deployerAddress);

        // Alice should get her locked alpaca back
        // penalty = 1% * 10(remaining week) * 10(amount to withdraw)
        // = 1
        // expect to get 10 - 1 = 9 back
        expect(alpacaAliceAfter.sub(alpacaAliceBefore)).to.be.eq(ethers.utils.parseEther("9"));

        // Deployer should get 50% of penalty
        // 1 * 50% = 0.5 alpaca
        expect(alpacaDeployerAfter.sub(alpacaDeployerBefore)).to.be.eq(ethers.utils.parseEther("0.5"));
      });
    });

    context("when lock not expired but paritally early withdrawn", async () => {
      it("should have xALPACA left", async () => {
        // deployer as treasury, eve as redistributor
        await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 20 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));

        const alpacaAliceBefore = await ALPACA.balanceOf(aliceAddress);
        const alpacaDeployerBefore = await ALPACA.balanceOf(deployerAddress);

        // Alice early withdraw
        await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"));

        const alpacaAliceAfter = await ALPACA.balanceOf(aliceAddress);
        const alpacaDeployerAfter = await ALPACA.balanceOf(deployerAddress);

        // Alice should get her locked alpaca back
        // penalty = 1% * 20(remaining week) * 5(amount to withdraw)
        // = 1
        // expect to get 5 - 1 = 4 back
        expect(alpacaAliceAfter.sub(alpacaAliceBefore)).to.be.eq(ethers.utils.parseEther("4"));

        // Deployer should get 50% of penalty
        // 1 * 50% = 0.5 alpaca
        expect(alpacaDeployerAfter.sub(alpacaDeployerBefore)).to.be.eq(ethers.utils.parseEther("0.5"));
      });
    });

    context("when breaker is on", async () => {
      it("should revert", async () => {
        // deployer as treasury, eve as redistributor
        await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));

        // put the breaker on
        await xALPACA.setBreaker(1);

        // Alice early withdraw should revert
        await expect(xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"))).to.be.revertedWith("breaker");
      });
    });

    context("when withdraw amount = 0", async () => {
      it("should revert", async () => {
        // deployer as treasury, eve as redistributor
        await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));

        // Alice early withdraw should revert since amount = 0
        await expect(xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("0"))).to.be.revertedWith("!>0");
      });
    });


    context("when alice try to withdraw more than locked", async () => {
      it("should revert", async () => {
        // deployer as treasury, eve as redistributor
        await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
        const lockAmount = ethers.utils.parseEther("10");
        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        // Set timestamp to the starting of next week
        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        // Alice create lock with expire in 1 week
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));

        // Alice early withdraw should revert since amount = 0
        await expect(xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("11"))).to.be.revertedWith("!enough");
      });
    });
  });

  describe("#redistribute", async () => {
    describe("when there's outstanding redistribute",async ()=> {

      context("when redistributors call", async () => {
        it("should work", async () => {
          // deployer as treasury, eve as redistributor
          // 1% per remaining week penalty, 50% goes to treasury
          await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
          await xALPACA.setWhitelistedRedistributors([aliceAddress],true);
          const lockAmount = ethers.utils.parseEther("10");
          await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
  
          // Set timestamp to the starting of next week
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));
  
          // Alice create lock with expire in 20 week
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));
  
          const alpacaEveBefore = await ALPACA.balanceOf(eveAddress);
  
          // Alice should get her locked alpaca back
          // penalty = 1% * 20(remaining week) * 5(amount to withdraw)
          // = 1
          // expect to get 5 - 1 = 4 back
  
          // Deployer should get 50% of penalty
          // 1 * 50% = 0.5 alpaca
  
          // Eve should get the rest for redistribution
          // penalty - treasury = 1 - 0.5 = 0.5
  
          // Alice early withdraw
          await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"));
          expect(await xALPACA.accumRedistribute()).to.be.eq(ethers.utils.parseEther("0.5"))
  
          // Alice earlywithdraw again. This should add more to accum redistribute
          await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"));
  
          // Now eve should be eligible for 
          // 0.5 + 0.5 = 1 alpaca
          let alpacaEveAfter = await ALPACA.balanceOf(eveAddress);
          expect(alpacaEveAfter.sub(alpacaEveBefore)).to.be.eq(ethers.utils.parseEther("0"));
          expect(await xALPACA.accumRedistribute()).to.be.eq(ethers.utils.parseEther("1"))
  
        //  const a = await xALPACA.redistribute();
          await xALPACAasAlice.redistribute();
  
          alpacaEveAfter = await ALPACA.balanceOf(eveAddress);
          expect(alpacaEveAfter.sub(alpacaEveBefore)).to.be.eq(ethers.utils.parseEther("1"));
          expect(await xALPACA.accumRedistribute()).to.be.eq(ethers.utils.parseEther("0"))
        });
      });

      context("when not redistributors call",async () => {
        it("should revert", async() => {
          // deployer as treasury, eve as redistributor
          // 1% per remaining week penalty, 50% goes to treasury
          await xALPACA.setEarlyWithdrawConfig(100, 5000, deployerAddress, eveAddress);
          const lockAmount = ethers.utils.parseEther("10");
          await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);
  
          // Set timestamp to the starting of next week
          await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));
  
          // Alice create lock with expire in 20 week
          await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK.mul(20)));
  
          const alpacaEveBefore = await ALPACA.balanceOf(eveAddress);
  
          // Alice should get her locked alpaca back
          // penalty = 1% * 20(remaining week) * 5(amount to withdraw)
          // = 1
          // expect to get 5 - 1 = 4 back
  
          // Deployer should get 50% of penalty
          // 1 * 50% = 0.5 alpaca
  
          // Eve should get the rest for redistribution
          // penalty - treasury = 1 - 0.5 = 0.5
  
          // Alice early withdraw
          await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"));
          expect(await xALPACA.accumRedistribute()).to.be.eq(ethers.utils.parseEther("0.5"))
  
          // Alice earlywithdraw again. This should add more to accum redistribute
          await xALPACAasAlice.earlyWithdraw(ethers.utils.parseEther("5"));
  
          // Now eve should be eligible for 
          // 0.5 + 0.5 = 1 alpaca
          let alpacaEveAfter = await ALPACA.balanceOf(eveAddress);
          expect(alpacaEveAfter.sub(alpacaEveBefore)).to.be.eq(ethers.utils.parseEther("0"));
          expect(await xALPACA.accumRedistribute()).to.be.eq(ethers.utils.parseEther("1"))
  
          await expect(xALPACA.redistribute()).to.be.revertedWith("not redistributors");
        });
      })
    });
  });

  describe("#breaker", async () => {
    context("when random user try to set breaker", async () => {
      it("should revert", async () => {
        await expect(xALPACAasAlice.setBreaker("1")).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("when breaker is not 0 or 1", async () => {
      it("should revert", async () => {
        await expect(xALPACA.setBreaker("888")).to.be.revertedWith("only 0 or 1");
      });
    });

    context("when user withdraw after breaker is on", async () => {
      it("should allow user to withdraw", async () => {
        const lockAmount = ethers.utils.parseEther("10");
        const stages: any = {};

        await ALPACAasAlice.approve(xALPACA.address, ethers.constants.MaxUint256);

        expect(await xALPACA.totalSupply()).to.be.eq("0");
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq("0");

        await timeHelpers.setTimestamp((await timeHelpers.latestTimestamp()).div(WEEK).add(1).mul(WEEK));

        stages["beforeDeposits"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];
        const aliceBeginBalance = await ALPACA.balanceOf(aliceAddress);
        await xALPACAasAlice.createLock(lockAmount, (await timeHelpers.latestTimestamp()).add(WEEK));
        stages["aliceDeposit"] = [await timeHelpers.latestBlockNumber(), await timeHelpers.latestTimestamp()];

        await timeHelpers.increaseTimestamp(HOUR);

        // Alice try to do early withdraw, but it is not possible.
        // Expect that it should revert
        await expect(xALPACAasAlice.withdraw()).to.be.revertedWith("!lock expired");

        // Set breaker to be on
        await xALPACA.setBreaker("1");

        // Now, alice try to withdraw again.
        await xALPACAasAlice.withdraw();

        // Expect that Alice should get her ALPACA back
        expect(await ALPACA.balanceOf(aliceAddress)).to.be.eq(aliceBeginBalance);
        expect(await xALPACA.totalSupply()).to.be.eq("0");
        expect(await xALPACA.balanceOf(aliceAddress)).to.be.eq("0");
      });
    });
  });

  describe("#setWhitelistedCallers", async () => {
    context("when caller is owner", async () => {
      it("should be able to setWhitelist", async () => {
        await expect(xALPACA.setWhitelistedCallers([eveAddress],true)).to.be.emit(xALPACA,"LogSetWhitelistedCaller").withArgs(deployerAddress,eveAddress,true)  
      });
    });

    context("when caller is not owner", async () => {
      it("should reverted setWhitelistedCallers", async () => {
        await expect(xALPACAasBob.setWhitelistedCallers([eveAddress],true)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setWhitelistedCallers", async () => {
    context("when caller is owner", async () => {
      it("should be able to setWhitelist", async () => {
        await expect(xALPACA.setWhitelistedCallers([eveAddress],true)).to.be.emit(xALPACA,"LogSetWhitelistedCaller").withArgs(deployerAddress,eveAddress,true)  
      });
    });

    context("when caller is not owner", async () => {
      it("should reverted setWhitelistedCallers", async () => {
        await expect(xALPACAasBob.setWhitelistedCallers([eveAddress],true)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setWhitelistedRedistributors", async () => {
    context("when caller is owner", async () => {
      it("should be able to setWhitelist", async () => {
        await expect(xALPACA["setWhitelistedRedistributors(address[],bool)"]([aliceAddress],true)).to.be.emit(xALPACA,"LogSetWhitelistedRedistributors").withArgs(deployerAddress,aliceAddress,true)  
      });
    });

    context("when caller is not owner", async () => {
      it("should reverted setWhitelistedRedistributors", async () => {
        await expect(xALPACAasBob.setWhitelistedRedistributors([eveAddress],true)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });



  // Complex scneario based on:
  // https://github.com/curvefi/curve-dao-contracts/blob/master/tests/integration/VotingEscrow/test_voting_escrow.py
  describe("#complex", async () => {
    context("when multiple users use xALPACA", async () => {
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
        let timeDelta,
          aliceBalance,
          totalSupply,
          bobBalance = ethers.BigNumber.from(0);
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
        expect(await xALPACA.totalSupplyAt(stages["beforeDeposits"][0])).to.be.eq(0);

        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit"][0]);
        assertHelpers.assertBigNumberClosePercent(
          aliceBalance,
          lockAmount.div(MAX_LOCK).mul(WEEK.sub(HOUR)),
          TOLERANCE
        );
        expect(await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit"][0])).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit"][0]);
        expect(totalSupply).to.be.eq(aliceBalance);

        for (const [index, ele] of stages["aliceIn0"].entries()) {
          aliceBalance = await xALPACA.balanceOfAt(aliceAddress, ele[0]);
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

          expect(bobBalance).to.be.eq(0);
          expect(aliceBalance).to.be.eq(totalSupply);

          const timeLeft = WEEK.mul(ethers.BigNumber.from(7).sub(index)).div(ethers.BigNumber.from(7).sub(HOUR.mul(2)));
          assertHelpers.assertBigNumberClosePercent(aliceBalance, lockAmount.div(MAX_LOCK.mul(timeLeft)), TOLERANCE);
        }

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceWithdraw"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceWithdraw"][0]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceWithdraw"][0]);
        expect(aliceBalance).to.be.eq(totalSupply);
        expect(totalSupply).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["aliceDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["aliceDeposit2"][0]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["aliceDeposit2"][0]);
        assertHelpers.assertBigNumberClosePercent(lockAmount.div(MAX_LOCK).mul(WEEK.mul(2)), totalSupply, TOLERANCE);
        expect(totalSupply).to.be.eq(aliceBalance);
        expect(bobBalance).to.be.eq(0);

        totalSupply = await xALPACA.totalSupplyAt(stages["bobDeposit2"][0]);
        aliceBalance = await xALPACA.balanceOfAt(aliceAddress, stages["bobDeposit2"][0]);
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobDeposit2"][0]);
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
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

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
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw1"][0]);
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
          bobBalance = await xALPACA.balanceOfAt(bobAddress, ele[0]);
          totalSupply = await xALPACA.totalSupplyAt(ele[0]);

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
        bobBalance = await xALPACA.balanceOfAt(bobAddress, stages["bobWithdraw2"][0]);
        expect(totalSupply).to.be.eq(aliceBalance.add(bobBalance));
        expect(totalSupply).to.be.eq(0);
      });
    });
  });


  
});
