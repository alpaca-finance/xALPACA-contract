import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades, waffle } from "hardhat";
import { BEP20, BEP20__factory, Tribute, Tribute__factory } from "../../typechain";
import { formatBigNumber } from "../../utils/format";
import { MerkleDistributorInfo, parseBalanceMap } from "../../utils/merkle/parse-balance-map";
import { setStartNextWeek } from "../helpers/time";

describe("Tribute", async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let merkles: Array<{ merkle: MerkleDistributorInfo; totalSupply: BigNumber }>;

  let rewardToken: BEP20;
  let tribute: Tribute;

  async function fixture() {
    [deployer, alice, bob] = await ethers.getSigners();

    // Deploy Reward Token
    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    rewardToken = await BEP20.deploy("Reward Token", "RWD");

    // Deploy Tribute
    const Tribute = (await ethers.getContractFactory("Tribute", deployer)) as Tribute__factory;
    tribute = (await upgrades.deployProxy(Tribute, [rewardToken.address])) as Tribute;

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
          totalSupply: BigNumber.from("45"),
          merkle: parseBalanceMap({
            [alice.address]: formatBigNumber(30, "purehex"),
            [bob.address]: formatBigNumber(15, "purehex"),
          }),
        },
      ]
    );

    // Prepare auth
    await tribute.setKeepersOk([deployer.address], true);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  context("#notifyReward", async () => {
    context("when params are valid", async () => {
      it("should work", async () => {
        // Move timestamp to start of the next week for testing
        const timestamp = await setStartNextWeek();

        await tribute.notifyReward(
          merkles[0].merkle.merkleRoot,
          ethers.utils.parseUnits("1000", 18),
          merkles[0].totalSupply
        );

        expect(await tribute.weeklyMerkleRoot(timestamp)).to.be.eq(merkles[0].merkle.merkleRoot);
        expect(await tribute.tokensPerWeek(timestamp)).to.be.eq(ethers.utils.parseUnits("1000", 18));
        expect(await tribute.totalSupplyAt(timestamp)).to.be.eq(merkles[0].totalSupply);
        expect(await tribute.lastNotifyRewardWeekCursor()).to.be.eq(timestamp);
      });
    });
  });
});
