// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { xALPACAMigrator_BaseTest, IERC20Upgradeable } from "./xALPACAMigrator_BaseTest.t.sol";

contract xALPACAMigrator_WithdrawTest is xALPACAMigrator_BaseTest {
  function testCorrectness_WhenLockExpiredAndUserWithdraw_ShouldWork() external {
    // warp timestamp so that alice and bob locks expired
    vm.warp(block.timestamp + 3 weeks);

    vm.prank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    uint256 _aliceAlpacaBefore = IERC20Upgradeable(alpaca).balanceOf(ALICE);
    uint256 _bobAlpacaBefore = IERC20Upgradeable(alpaca).balanceOf(BOB);

    vm.prank(ALICE);
    xalpacaMigrator.withdraw();
    vm.prank(BOB);
    xalpacaMigrator.withdraw();

    assertEq(IERC20Upgradeable(alpaca).balanceOf(ALICE) - _aliceAlpacaBefore, aliceLockAmount);
    assertEq(IERC20Upgradeable(alpaca).balanceOf(BOB) - _bobAlpacaBefore, bobLockAmount);
  }
}
