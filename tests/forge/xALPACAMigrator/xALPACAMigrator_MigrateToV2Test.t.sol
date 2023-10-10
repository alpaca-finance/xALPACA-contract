// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { xALPACAMigrator_BaseTest, IERC20Upgradeable } from "./xALPACAMigrator_BaseTest.t.sol";

contract xALPACAMigrator_MigrateToV2Test is xALPACAMigrator_BaseTest {
  function testRevert_WhenNotOwnerCallMigrateToV2_ShoudlRevert() external {
    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    vm.expectRevert("Ownable: caller is not the owner");
    xalpacaMigrator.migrateToV2(_users);
  }

  function testCorrectness_WhenMigrateUserWithNoLock_ShouldSkip() external {
    vm.startPrank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    address[] memory _users = new address[](1);
    _users[0] = CAT;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    assertEq(xAlpacaV2.userLockAmounts(CAT), 0);
    assertEq(xAlpacaV2.totalLocked(), 0);
  }

  function testCorrectness_WhenLockNotExpiredAndMigrateToV2_ShouldWork() external {
    vm.startPrank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    assertEq(xAlpacaV2.userLockAmounts(ALICE), aliceLockAmount);
    assertEq(xAlpacaV2.userLockAmounts(BOB), bobLockAmount);
    assertEq(xAlpacaV2.totalLocked(), aliceLockAmount + bobLockAmount);
  }

  function testCorrectness_WhenLockExpiredAndMigrateToV2_ShouldWork() external {
    // warp timestamp so that alice and bob locks expired
    vm.warp(block.timestamp + 3 weeks);

    vm.startPrank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    assertEq(xAlpacaV2.userLockAmounts(ALICE), aliceLockAmount);
    assertEq(xAlpacaV2.userLockAmounts(BOB), bobLockAmount);
    assertEq(xAlpacaV2.totalLocked(), aliceLockAmount + bobLockAmount);
  }
}
