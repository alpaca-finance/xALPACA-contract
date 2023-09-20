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
    setupMiniFLPool();
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
    miniFL.harvest(wethPoolID);

    assertEq(_balanceBefore, alpaca.balanceOf(ALICE));
  }

  // note: ref pending reward from MiniFL_PendingReward.sol:testCorrectness_WhenTimpast_PendingAlpacaShouldBeCorrectly
  function testCorrectness_WhenTimepast_AndHarvest() external {
    // timpast for 100 second
    vm.warp(block.timestamp + 100);
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    uint256 _bobAlpacaBefore = alpaca.balanceOf(BOB);

    // alice pending alpaca on WETHPool = 40000
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    vm.prank(ALICE);
    miniFL.harvest(wethPoolID);
    assertTotalUserStakingAmountWithReward(ALICE, wethPoolID, _aliceTotalWethDeposited, 40000 ether);
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 0);

    // alice pending alpaca on DTOKENPool = 4000
    vm.prank(ALICE);
    miniFL.harvest(mockToken1PoolID);
    assertTotalUserStakingAmountWithReward(ALICE, mockToken1PoolID, _aliceDTokenDeposited, 4000 ether);

    // bob pending alpaca on WETHPool = 20000
    vm.prank(BOB);
    miniFL.harvest(wethPoolID);
    assertTotalUserStakingAmountWithReward(BOB, wethPoolID, _bobTotalWethDeposited, 20000 ether);

    // bob pending alpaca on DTOKENPool = 36000
    vm.prank(BOB);
    miniFL.harvest(mockToken1PoolID);
    assertTotalUserStakingAmountWithReward(BOB, mockToken1PoolID, _bobDTokenDeposited, 36000 ether);

    // assert all alpaca received
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 44000 ether);
    assertEq(alpaca.balanceOf(BOB) - _bobAlpacaBefore, 56000 ether);
  }

  function testCorrectness_WhenTimepast_AndHarvestMany() external {
    // timpast for 100 second
    vm.warp(block.timestamp + 100);
    uint256[] memory _pids = new uint256[](2);
    _pids[0] = wethPoolID;
    _pids[1] = mockToken1PoolID;

    uint256 _balanceBefore = alpaca.balanceOf(ALICE);
    // alice pending alpaca on WETHPool = 40000
    // alice pending alpaca on DTOKENPool = 4000
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, ALICE), 4000 ether);

    vm.prank(ALICE);
    miniFL.harvestMany(_pids);

    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 0);
    assertTotalUserStakingAmountWithReward(ALICE, wethPoolID, _aliceTotalWethDeposited, 40000 ether);
    assertTotalUserStakingAmountWithReward(ALICE, mockToken1PoolID, _aliceDTokenDeposited, 4000 ether);

    // assert all alpaca received
    uint256 _balanceAfter = alpaca.balanceOf(ALICE);
    assertEq(_balanceAfter - _balanceBefore, 44000 ether);
  }

  function testRevert_AlpacaIsNotEnoughForHarvest() external {
    // timepast too far, made alpaca distributed 1000000 * 1000 = 1000,000,000 but alpaca in miniFL has only 10,000,000
    vm.warp(block.timestamp + 1000000);

    vm.expectRevert();
    vm.prank(ALICE);
    miniFL.harvest(wethPoolID);
  }
}
