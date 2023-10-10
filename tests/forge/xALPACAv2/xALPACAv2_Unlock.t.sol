// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "../base/BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_UnlockTest is BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    xAlpacaV2.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToUnlockMoreThanLocked_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAmount.selector));
    xAlpacaV2.unlock(11 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAmount.selector));
    xAlpacaV2.unlock(0 ether);

    vm.stopPrank();
  }

  function testCorrectness_WhenUserDoMultipleUnlock_ShouldWork() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    xAlpacaV2.unlock(4 ether);
    assertEq(xAlpacaV2.totalLocked(), 6 ether);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), 6 ether);
    uint256 _firstUnlockTimestamp = block.timestamp + DELAY_UNLOCK_TIME;

    // 1000 seconds pass
    skip(1000);

    xAlpacaV2.unlock(6 ether);
    assertEq(xAlpacaV2.totalLocked(), 0 ether);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), 0 ether);

    uint256 _secondUnlockTimestamp = block.timestamp + DELAY_UNLOCK_TIME;

    assertEq(xAlpacaV2.userUnlockRequestsLastId(ALICE), 2);

    (uint256 _amount, uint64 _unlockTimestamp, xALPACAv2.UnlockStatus _status) = xAlpacaV2.userUnlockRequests(ALICE, 0);
    assertEq(_amount, 4 ether);
    assertEq(_unlockTimestamp, _firstUnlockTimestamp);
    assertEq(uint8(_status), 0);

    (_amount, _unlockTimestamp, _status) = xAlpacaV2.userUnlockRequests(ALICE, 1);
    assertEq(_amount, 6 ether);
    assertEq(_unlockTimestamp, _secondUnlockTimestamp);
    assertEq(uint8(_status), 0);
    vm.stopPrank();
  }

  function testCorrectness_WhenBreakerIsOn_UserShouldGetToken() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);
    vm.stopPrank();

    xAlpacaV2.setBreaker(1);

    vm.startPrank(ALICE);
    xAlpacaV2.unlock(4 ether);

    assertEq(alpaca.balanceOf(ALICE), 94 ether); // start at 100, lock 10, unlock 4, result in 94
    vm.stopPrank();
  }
}
