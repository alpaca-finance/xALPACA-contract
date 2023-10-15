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

    uint256 userPointEpochBefore = xalpacaMigrator.userPointEpoch(CAT);

    address[] memory _users = new address[](1);
    _users[0] = CAT;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    (int128 _catLockedAmountAfter, uint256 _catEndAfter) = xalpacaMigrator.locks(CAT);

    assertEq(_catLockedAmountAfter, 0);
    assertEq(_catEndAfter, 0);
    assertEq(xalpacaMigrator.userPointEpoch(CAT), userPointEpochBefore);

    assertEq(xAlpacaV2.userLockAmounts(CAT), 0);
    assertEq(xAlpacaV2.totalLocked(), 0);
  }

  function testCorrectness_WhenLockExpiredAndMigrateToV2_ShouldSkip() external {
    // warp timestamp so that alice and bob locks expired
    vm.warp(block.timestamp + 3 weeks);

    uint256 _alicePointEpochBefore = xalpacaMigrator.userPointEpoch(ALICE);
    uint256 _bobPointEpochBefore = xalpacaMigrator.userPointEpoch(BOB);
    vm.startPrank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    (int128 _aliceLockedAmountAfter, uint256 _aliceEndAfter) = xalpacaMigrator.locks(ALICE);
    (int128 _bobLockedAmountAfter, uint256 _bobEndAfter) = xalpacaMigrator.locks(BOB);

    // assert alice
    assert(_aliceEndAfter != 0);
    assertEq(_aliceLockedAmountAfter, 10 ether);
    assertEq(xalpacaMigrator.userPointEpoch(ALICE), _alicePointEpochBefore);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), 0);

    // assert bob
    assert(_bobEndAfter != 0);
    assertEq(_bobLockedAmountAfter, 20 ether);
    assertEq(xalpacaMigrator.userPointEpoch(BOB), _bobPointEpochBefore);
    assertEq(xAlpacaV2.userLockAmounts(BOB), 0);

    assertEq(xAlpacaV2.totalLocked(), 0);
  }

  function testCorrectness_WhenLockNotExpiredAndMigrateToV2_ShouldWork() external {
    vm.startPrank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    uint256 _alicePointEpochBefore = xalpacaMigrator.userPointEpoch(ALICE);
    uint256 _bobPointEpochBefore = xalpacaMigrator.userPointEpoch(BOB);

    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    xalpacaMigrator.migrateToV2(_users);

    vm.stopPrank();

    (int128 _aliceLockedAmountAfter, uint256 _aliceEndAfter) = xalpacaMigrator.locks(ALICE);
    (int128 _bobLockedAmountAfter, uint256 _bobEndAfter) = xalpacaMigrator.locks(BOB);

    // assert alice
    assertEq(_aliceLockedAmountAfter, 0);

    assertEq(_aliceEndAfter, 0);
    assertEq(xalpacaMigrator.userPointEpoch(ALICE), _alicePointEpochBefore + 1);
    assertEq(xalpacaMigrator.balanceOf(ALICE), 0);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), aliceLockAmount);

    // assert bob
    assertEq(_bobLockedAmountAfter, 0);
    assertEq(_bobEndAfter, 0);
    assertEq(xalpacaMigrator.userPointEpoch(BOB), _bobPointEpochBefore + 1);
    assertEq(xalpacaMigrator.balanceOf(BOB), 0);
    assertEq(xAlpacaV2.userLockAmounts(BOB), bobLockAmount);

    assertEq(xAlpacaV2.totalLocked(), aliceLockAmount + bobLockAmount);
  }
}
