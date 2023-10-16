// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { xALPACAMigrator_BaseTest, IERC20Upgradeable, xALPACAMigrator, console } from "./xALPACAMigrator_BaseTest.t.sol";

contract xALPACAMigrator_WithdrawTest is xALPACAMigrator_BaseTest {
  function testCorrectness_WhenLockExpiredAndUserWithdraw_ShouldWork() external {
    // warp timestamp so that alice and bob locks expired
    vm.warp(block.timestamp + 3 weeks);

    vm.prank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    uint256 _aliceAlpacaBefore = IERC20Upgradeable(alpaca).balanceOf(ALICE);
    uint256 _alicePointEpochBefore = xalpacaMigrator.userPointEpoch(ALICE);
    (int128 _aliceLockedAmountBefore, ) = xalpacaMigrator.locks(ALICE);

    uint256 _bobAlpacaBefore = IERC20Upgradeable(alpaca).balanceOf(BOB);
    uint256 _bobPointEpochBefore = xalpacaMigrator.userPointEpoch(BOB);
    (int128 _bobLockedAmountBefore, ) = xalpacaMigrator.locks(BOB);

    assertEq(_aliceLockedAmountBefore, 10 ether);
    assertEq(_bobLockedAmountBefore, 20 ether);

    vm.prank(ALICE);
    xalpacaMigrator.withdraw();
    vm.prank(BOB);
    xalpacaMigrator.withdraw();

    (int128 _aliceLockedAmountAfter, ) = xalpacaMigrator.locks(ALICE);
    (int128 _bobLockedAmountAfter, ) = xalpacaMigrator.locks(BOB);

    // assert ALICE
    assertEq(xalpacaMigrator.balanceOf(ALICE), 0);
    assertEq(_aliceLockedAmountAfter, 0);
    assertEq(IERC20Upgradeable(alpaca).balanceOf(ALICE) - _aliceAlpacaBefore, aliceLockAmount);
    assertEq(xalpacaMigrator.userPointEpoch(ALICE), _alicePointEpochBefore + 1);

    // assert BOB
    assertEq(xalpacaMigrator.balanceOf(BOB), 0);
    assertEq(_bobLockedAmountAfter, 0);
    assertEq(xalpacaMigrator.userPointEpoch(BOB), _bobPointEpochBefore + 1);
    assertEq(IERC20Upgradeable(alpaca).balanceOf(BOB) - _bobAlpacaBefore, bobLockAmount);
  }
}
