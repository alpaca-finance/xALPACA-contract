// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest, console } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_HarvestWithRewarderTest is MiniFL_BaseTest {
  uint256 _aliceTotalWethDeposited = 20 ether;
  uint256 _aliceDTokenDeposited = 10 ether;

  uint256 _bobTotalWethDeposited = 10 ether;
  uint256 _bobDTokenDeposited = 90 ether;

  function setUp() public override {
    super.setUp();

    setupRewarder();
    prepareForHarvest();

    // deposited info
    // --------------------------------------
    // | Pool                 | ALICE | BOB |
    // |----------------------|-------|-----|
    // | WETH                 |    20 |  10 |
    // | DToken               |    10 |  90 |
    // | WETH (rewarder1)     |    20 |  10 |
    // | DToken (rewarder 1)  |    10 |  90 |
    // | WETH (rewarder 2)    |    20 |  10 |
    // | DToken (rewarder 2)  |     0 |   0 | NOTE: because rewarder 2 is not register to DToken Pool
    // --------------------------------------
  }

  function testCorrectness_WhenTimepast_AndHarvest_GotAllReward() external {
    // timpast for 100 second
    skip(100);

    // assets before
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    uint256 _aliceReward1Before = rewardToken1.balanceOf(ALICE);
    uint256 _aliceReward2Before = rewardToken2.balanceOf(ALICE);

    uint256 _bobAlpacaBefore = alpaca.balanceOf(BOB);
    uint256 _bobReward1Before = rewardToken1.balanceOf(BOB);
    uint256 _bobReward2Before = rewardToken2.balanceOf(BOB);

    // note: ref pending reward from MiniFL_PendingRewardWithRewarder.sol:testCorrectness_WhenTimpast_RewarderPendingTokenShouldBeCorrectly
    // ALICE Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          40000 |           6000 |          10000 |
    // |  DToken |           4000 |            100 |              0 |
    // |   Total |          44000 |           6100 |          10000 |
    // --------------------------------------------------------------
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 40000 ether);
    assertRewarderUserInfo(rewarder1, ALICE, _aliceTotalWethDeposited, 6000 ether);
    assertRewarderUserInfo(rewarder2, ALICE, _aliceTotalWethDeposited, 10000 ether);

    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceDTokenDeposited, 4000 ether);
    assertRewarderUserInfo(rewarder1, ALICE, _aliceDTokenDeposited, 100 ether);
    assertRewarderUserInfo(rewarder2, ALICE, 0, 0);

    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 44000 ether);
    assertEq(rewardToken1.balanceOf(ALICE) - _aliceReward1Before, 6100 ether);
    assertEq(rewardToken2.balanceOf(ALICE) - _aliceReward2Before, 10000 ether);

    // BOB Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          20000 |           3000 |           5000 |
    // |  DToken |          36000 |            900 |              0 |
    // |   Total |          56000 |           3900 |           5000 |
    // --------------------------------------------------------------
    vm.prank(BOB);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(BOB, _bobTotalWethDeposited, 20000 ether);
    assertRewarderUserInfo(rewarder1, BOB, _bobTotalWethDeposited, 3000 ether);
    assertRewarderUserInfo(rewarder2, BOB, _bobTotalWethDeposited, 5000 ether);

    vm.prank(BOB);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(BOB, _bobDTokenDeposited, 36000 ether);
    assertRewarderUserInfo(rewarder1, BOB, _bobDTokenDeposited, 900 ether);
    assertRewarderUserInfo(rewarder2, BOB, 0, 0);

    assertEq(alpaca.balanceOf(BOB) - _bobAlpacaBefore, 56000 ether);
    assertEq(rewardToken1.balanceOf(BOB) - _bobReward1Before, 3900 ether);
    assertEq(rewardToken2.balanceOf(BOB) - _bobReward2Before, 5000 ether);
  }

  function testRevert_Rewarder1IsNotEnoughForHarvest() external {
    skip(100);
    // burned all token in rewarder1
    address _reward = address(rewarder1);
    rewardToken1.burn(_reward, rewardToken1.balanceOf(_reward));

    // should revert when rewarder try transfer reward to ALICE
    vm.expectRevert();
    vm.prank(ALICE);
    miniFL.harvest();
  }
}
