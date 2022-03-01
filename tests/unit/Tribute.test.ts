import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades, waffle } from "hardhat";
import { BEP20, BEP20__factory, RootStorage, RootStorage__factory, Tribute, Tribute__factory } from "../../typechain";
import { formatBigNumber } from "../../utils/format";
import { MerkleDistributorInfo, parseBalanceMap } from "../../utils/merkle/parse-balance-map";
import * as timeHelpers from "../helpers/time";

describe("Tribute", async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let merkles: Array<{ merkle: MerkleDistributorInfo; totalSupply: BigNumber }>;
  let disputeMerkles: Array<{ merkle: MerkleDistributorInfo; totalSupply: BigNumber }>;

  let rewardToken: BEP20;
  let rootStorage: RootStorage;
  let tribute: Tribute;

  async function fixture() {
    [deployer, alice, bob] = await ethers.getSigners();

    // Deploy Reward Token
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    rewardToken = await BEP20.deploy("Reward Token", "RWD");

    // Deploy RootStorage
    const RootStorage = (await ethers.getContractFactory("RootStorage", deployer)) as RootStorage__factory;
    rootStorage = (await upgrades.deployProxy(RootStorage, ["Some Root Storage"])) as RootStorage;

    // Deploy Tribute
    const Tribute = (await ethers.getContractFactory("Tribute", deployer)) as Tribute__factory;
    tribute = (await upgrades.deployProxy(Tribute, [rootStorage.address, rewardToken.address])) as Tribute;

    // Prepare tokens
    await rewardToken.mint(deployer.address, ethers.utils.parseUnits("1000000", 18));
    await rewardToken.approve(tribute.address, ethers.constants.MaxUint256);

    // Prepare merkles
    merkles = [];
    merkles.push(
      ...[
        {
          totalSupply: BigNumber.from("90"),
          merkle: parseBalanceMap({
            [alice.address]: formatBigNumber(60, "purehex"),
            [bob.address]: formatBigNumber(30, "purehex"),
          }),
        },
        {
          totalSupply: BigNumber.from("60"),
          merkle: parseBalanceMap({
            [alice.address]: formatBigNumber(30, "purehex"),
            [bob.address]: formatBigNumber(30, "purehex"),
          }),
        },
        {
          totalSupply: BigNumber.from("22"),
          merkle: parseBalanceMap({
            [alice.address]: formatBigNumber(15, "purehex"),
            [bob.address]: formatBigNumber(7, "purehex"),
          }),
        },
      ]
    );

    disputeMerkles = [];
    disputeMerkles.push(
      ...[
        {
          totalSupply: BigNumber.from("90"),
          merkle: parseBalanceMap({
            [alice.address]: formatBigNumber(50, "purehex"),
            [bob.address]: formatBigNumber(40, "purehex"),
          }),
        },
      ]
    );

    // Prepare auth
    await rootStorage.setKeepersOk([deployer.address], true);
    await tribute.setKeepersOk([deployer.address], true);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  context("#notifyReward", async () => {
    context("when root storage doesn't has merkle root", async () => {
      it("should revert", async () => {
        // Move timestamp to start of the next week
        await timeHelpers.setStartNextWeek();
        await expect(tribute.notifyReward(ethers.utils.parseUnits("1000", 18))).to.be.revertedWith(
          "Tribute_MerkleRootNotSet()"
        );
      });
    });

    context("when params are valid", async () => {
      it("should work", async () => {
        // Move timestamp to start of the next week for testing
        let timestamp = await timeHelpers.setStartNextWeek();

        let deployerRewardBefore = await rewardToken.balanceOf(deployer.address);
        await rootStorage.notify(merkles[0].merkle.merkleRoot, merkles[0].totalSupply);
        await tribute.notifyReward(ethers.utils.parseUnits("1000", 18));
        let deployerRewardAfter = await rewardToken.balanceOf(deployer.address);

        expect(deployerRewardBefore.sub(deployerRewardAfter)).to.be.equal(ethers.utils.parseUnits("1000", 18));
        expect(await rootStorage.weeklyMerkleRoot(timestamp)).to.be.eq(merkles[0].merkle.merkleRoot);
        expect(await tribute.tokensPerWeek(timestamp)).to.be.eq(ethers.utils.parseUnits("1000", 18));
        expect(await rootStorage.totalSupplyAt(timestamp)).to.be.eq(merkles[0].totalSupply);
        expect(await tribute.lastNotifyRewardWeekCursor()).to.be.eq(timestamp);

        // Move timestamp to start of the next week
        timestamp = await timeHelpers.setStartNextWeek();

        deployerRewardBefore = await rewardToken.balanceOf(deployer.address);
        await rootStorage.notify(merkles[1].merkle.merkleRoot, merkles[1].totalSupply);
        await tribute.notifyReward(ethers.utils.parseUnits("1000", 18));
        deployerRewardAfter = await rewardToken.balanceOf(deployer.address);

        expect(deployerRewardBefore.sub(deployerRewardAfter)).to.be.equal(ethers.utils.parseUnits("1000", 18));
        expect(await rootStorage.weeklyMerkleRoot(timestamp)).to.be.eq(merkles[1].merkle.merkleRoot);
        expect(await tribute.tokensPerWeek(timestamp)).to.be.eq(ethers.utils.parseUnits("1000", 18));
        expect(await rootStorage.totalSupplyAt(timestamp)).to.be.eq(merkles[1].totalSupply);
        expect(await tribute.lastNotifyRewardWeekCursor()).to.be.eq(timestamp);
      });
    });
  });

  context("#claim", async () => {
    let stages: any;

    beforeEach(async () => {
      stages = {};
      // Move to start of next week
      stages["week0"] = await timeHelpers.setStartNextWeek();

      await rootStorage.notify(merkles[0].merkle.merkleRoot, merkles[0].totalSupply);
      await tribute.notifyReward(ethers.utils.parseUnits("1000", 18));
    });

    context("when claim before settle", async () => {
      it("should revert", async () => {
        await expect(
          tribute.claim(
            await timeHelpers.latestTimestamp(),
            0,
            alice.address,
            merkles[0].merkle.claims[alice.address].amount,
            merkles[0].merkle.claims[alice.address].proof
          )
        ).to.be.revertedWith("Tribute_InvalidTimestamp()");
      });
    });

    context("when claim with future timestamp", async () => {
      it("should revert", async () => {
        await expect(
          tribute.claim(
            (await timeHelpers.latestTimestamp()).add(timeHelpers.YEAR),
            0,
            alice.address,
            merkles[0].merkle.claims[alice.address].amount,
            merkles[0].merkle.claims[alice.address].proof
          )
        ).to.be.revertedWith("Tribute_InvalidTimestamp()");
      });
    });

    context("when timestamp is valid", async () => {
      beforeEach(async () => {
        // Move to start of next week
        stages["week1"] = await timeHelpers.setStartNextWeek();
        await rootStorage.notify(merkles[1].merkle.merkleRoot, merkles[1].totalSupply);
        await tribute.notifyReward(ethers.utils.parseUnits("1000", 18));
      });

      context("when claim with invalid amount", async () => {
        it("should revert", async () => {
          await expect(
            tribute.claim(stages["week0"], 0, alice.address, 0, merkles[0].merkle.claims[alice.address].proof)
          ).to.be.revertedWith("Tribute_InvalidMerkleProof()");
        });
      });

      context("when claim with invalid proof", async () => {
        it("should revert", async () => {
          await expect(
            tribute.claim(stages["week0"], 0, alice.address, merkles[0].merkle.claims[alice.address].amount, [])
          ).to.be.revertedWith("Tribute_InvalidMerkleProof()");
        });
      });

      context("when claim with valid proof", async () => {
        it("should work", async () => {
          const expectedAliceReward = (await tribute.tokensPerWeek(stages["week0"]))
            .mul(merkles[0].merkle.claims[alice.address].amount)
            .div(merkles[0].totalSupply);

          // Assert that callStatic return the expected rewards
          expect(
            await tribute.callStatic.claim(
              stages["week0"],
              merkles[0].merkle.claims[alice.address].index,
              alice.address,
              merkles[0].merkle.claims[alice.address].amount,
              merkles[0].merkle.claims[alice.address].proof
            )
          ).to.be.eq(expectedAliceReward);

          // Perform the actual claim
          const aliceRewardBefore = await rewardToken.balanceOf(alice.address);
          await tribute.claim(
            stages["week0"],
            merkles[0].merkle.claims[alice.address].index,
            alice.address,
            merkles[0].merkle.claims[alice.address].amount,
            merkles[0].merkle.claims[alice.address].proof
          );
          const aliceRewardAfter = await rewardToken.balanceOf(alice.address);

          expect(aliceRewardAfter.sub(aliceRewardBefore)).to.be.eq(expectedAliceReward);

          const expectedBobReward = (await tribute.tokensPerWeek(stages["week0"]))
            .mul(merkles[0].merkle.claims[bob.address].amount)
            .div(merkles[0].totalSupply);

          // Assert that callStatic return the expected rewards
          expect(
            await tribute.callStatic.claim(
              stages["week0"],
              merkles[0].merkle.claims[bob.address].index,
              bob.address,
              merkles[0].merkle.claims[bob.address].amount,
              merkles[0].merkle.claims[bob.address].proof
            )
          ).to.be.eq(expectedBobReward);

          // Perform the actual claim
          const bobRewardBefore = await rewardToken.balanceOf(bob.address);
          await tribute.claim(
            stages["week0"],
            merkles[0].merkle.claims[bob.address].index,
            bob.address,
            merkles[0].merkle.claims[bob.address].amount,
            merkles[0].merkle.claims[bob.address].proof
          );
          const bobRewardAfter = await rewardToken.balanceOf(bob.address);

          expect(bobRewardAfter.sub(bobRewardBefore)).to.be.eq(expectedBobReward);
        });
      });

      context("when claim twice", async () => {
        it("should revert", async () => {
          await tribute.claim(
            stages["week0"],
            merkles[0].merkle.claims[alice.address].index,
            alice.address,
            merkles[0].merkle.claims[alice.address].amount,
            merkles[0].merkle.claims[alice.address].proof
          );
          await expect(
            tribute.claim(
              stages["week0"],
              merkles[0].merkle.claims[alice.address].index,
              alice.address,
              merkles[0].merkle.claims[alice.address].amount,
              merkles[0].merkle.claims[alice.address].proof
            )
          ).to.be.revertedWith("Tribute_Claimed()");
        });
      });

      context("when claim last reward", async () => {
        it("should work after notifyReward(0)", async () => {
          stages["week2"] = await timeHelpers.setStartNextWeek();
          await rootStorage.notify(merkles[2].merkle.merkleRoot, merkles[2].totalSupply);
          await tribute.notifyReward(0);

          const aliceRewardBefore = await rewardToken.balanceOf(alice.address);
          await tribute.claim(
            stages["week1"],
            merkles[1].merkle.claims[alice.address].index,
            alice.address,
            merkles[1].merkle.claims[alice.address].amount,
            merkles[1].merkle.claims[alice.address].proof
          );
          const aliceRewardAfter = await rewardToken.balanceOf(alice.address);

          expect(aliceRewardAfter.sub(aliceRewardBefore)).to.be.eq(
            (await tribute.tokensPerWeek(stages["week1"]))
              .mul(merkles[1].merkle.claims[alice.address].amount)
              .div(merkles[1].totalSupply)
          );
        });
      });

      context("when dispute happened on RootStorage", async () => {
        it("should work with new proof", async () => {
          await rootStorage.dispute(disputeMerkles[0].merkle.merkleRoot, disputeMerkles[0].totalSupply);
          stages["week2"] = await timeHelpers.setStartNextWeek();
          await rootStorage.notify(merkles[2].merkle.merkleRoot, merkles[2].totalSupply);
          await tribute.notifyReward(0);

          // When passing the old merkle root. This should revert as it is disputed.
          await expect(
            tribute.claim(
              stages["week1"],
              merkles[1].merkle.claims[alice.address].index,
              alice.address,
              merkles[1].merkle.claims[alice.address].amount,
              merkles[1].merkle.claims[alice.address].proof
            )
          ).to.be.revertedWith("Tribute_InvalidMerkleProof()");

          // When pass with the right merkle root. This should work.
          const aliceRewardBefore = await rewardToken.balanceOf(alice.address);
          await tribute.claim(
            stages["week1"],
            disputeMerkles[0].merkle.claims[alice.address].index,
            alice.address,
            disputeMerkles[0].merkle.claims[alice.address].amount,
            disputeMerkles[0].merkle.claims[alice.address].proof
          );
          const aliceRewardAfter = await rewardToken.balanceOf(alice.address);

          expect(aliceRewardAfter.sub(aliceRewardBefore)).to.be.eq(
            (await tribute.tokensPerWeek(stages["week1"]))
              .mul(disputeMerkles[0].merkle.claims[alice.address].amount)
              .div(disputeMerkles[0].totalSupply)
          );
        });
      });
    });
  });
});
