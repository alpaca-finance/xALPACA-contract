// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_HarvestTest is MiniFL_BaseTest {
  uint256 _aliceTotalWethDeposited = 20 ether;
  uint256 _aliceDTokenDeposited = 10 ether;

  uint256 _bobTotalWethDeposited = 10 ether;
  uint256 _bobDTokenDeposited = 90 ether;

  function setUp() public override {
    super.setUp();

    prepareForHarvest();

    // deposited info
    // ------------------------
    // | Pool   | ALICE | BOB |
    // |--------|-------|-----|
    // | WETH   |    20 |  10 |
    // | DToken |    10 |  90 |
    // ------------------------
  }

  function testCorrectness_WhenHarvestWithNoRewardPending() external {
    // alpaca is base reward
    uint256 _balanceBefore = alpaca.balanceOf(ALICE);

    vm.prank(ALICE);
    miniFL.harvest();

    assertEq(_balanceBefore, alpaca.balanceOf(ALICE));
  }

  // note: ref pending reward from MiniFL_PendingReward.sol:testCorrectness_WhenTimpast_PendingAlpacaShouldBeCorrectly
  function testCorrectness_WhenTimepast_AndHarvest1() external {
    // timpast for 100 second
    skip(100);
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    uint256 _bobAlpacaBefore = alpaca.balanceOf(BOB);

    // alice pending alpaca on WETHPool = 40000
    assertEq(miniFL.pendingAlpaca(ALICE), 40000 ether);
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 40000 ether);
    assertEq(miniFL.pendingAlpaca(ALICE), 0);

    // alice pending alpaca on DTOKENPool = 4000
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceDTokenDeposited, 4000 ether);

    // bob pending alpaca on WETHPool = 20000
    vm.prank(BOB);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(BOB, _bobTotalWethDeposited, 20000 ether);

    // bob pending alpaca on DTOKENPool = 36000
    vm.prank(BOB);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(BOB, _bobDTokenDeposited, 36000 ether);

    // assert all alpaca received
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 44000 ether);
    assertEq(alpaca.balanceOf(BOB) - _bobAlpacaBefore, 56000 ether);
  }

  function testCorrectness_WhenFeedRewardBeforeRewardEnd_AndHarvest_ShouldGetRewardCorrectly() external {
    // ----------------------------------------------------------
    // | Time  | Reward Per sec | Pending Reward | Total Reward |
    // |-------|----------------|----------------|--------------|
    // |      0|            1000|               0|             0|
    // |     50|            1000|           20000|             0|
    // |     50|            2000|               0|         20000|
    // |    100|            2000|           40000|         60000|
    // |-------|----------------|----------------|--------------|

    skip(50);
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);

    // alice pending alpaca on WETHPool = 20000
    assertEq(miniFL.pendingAlpaca(ALICE), 20000 ether);
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 20000 ether);
    assertEq(miniFL.pendingAlpaca(ALICE), 0);

    // Feed more reward 1000 ether per sec for 50 secs
    miniFL.feed(1000 ether * 50, 50);

    skip(50);

    // alice pending alpaca on WETHPool = 40000
    assertEq(miniFL.pendingAlpaca(ALICE), 40000 ether);
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 60000 ether);
    assertEq(miniFL.pendingAlpaca(ALICE), 0);

    // assert all alpaca received
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 60000 ether);
  }

  function testCorrectness_WhenFeedRewardAfterRewardEnd_AndHarvest_ShouldGetRewardCorrectly() external {
    // ----------------------------------------------------------
    // | Time  | Reward Per sec | Pending Reward | Total Reward |
    // |-------|----------------|----------------|--------------|
    // |      0|            1000|               0|             0|
    // |    100|            1000|           40000|             0|
    // |    120|               0|               0|         40000|
    // |    120|             500|               0|         40000|
    // |    150|             500|            6000|         46000|
    // |-------|----------------|----------------|--------------|

    skip(100);

    // alice pending alpaca on WETHPool = 20000
    assertEq(miniFL.pendingAlpaca(ALICE), 40000 ether);
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 40000 ether);
    assertEq(miniFL.pendingAlpaca(ALICE), 0);

    skip(20);

    // Feed more reward 1000 ether per sec for 50 secs
    miniFL.feed(500 ether * 50, 50);

    skip(30);

    // alice pending alpaca on WETHPool = 40000
    assertEq(miniFL.pendingAlpaca(ALICE), 6000 ether);
    vm.prank(ALICE);
    miniFL.harvest();
    assertTotalUserStakingAmountWithReward(ALICE, _aliceTotalWethDeposited, 46000 ether);
    assertEq(miniFL.pendingAlpaca(ALICE), 0);
  }
}
