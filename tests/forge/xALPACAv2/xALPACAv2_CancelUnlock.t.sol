// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { xALPACAV2_BaseTest } from "../base/xALPACAV2_BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_CancelUnlockTest is xALPACAV2_BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    xAlpacaV2.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToCancelClaimedUnlock_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);

    xAlpacaV2.lock(ALICE, 10 ether);

    uint256 _unlockId = xAlpacaV2.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xAlpacaV2.cancelUnlock(_unlockId);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidStatus.selector));
    xAlpacaV2.withdraw(_unlockId);

    vm.stopPrank();
  }

  function testRevert_WhenUserWantToDoulbeCancel_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    uint256 _unlockId = xAlpacaV2.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xAlpacaV2.cancelUnlock(_unlockId);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidStatus.selector));
    xAlpacaV2.cancelUnlock(_unlockId);

    vm.stopPrank();
  }

  function testCorrectness_WhenUserCancel_UnclaimedUnlock_ShouldWork() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    uint256 _unlockId = xAlpacaV2.unlock(4 ether);

    xAlpacaV2.cancelUnlock(_unlockId);
    (, , xALPACAv2.UnlockStatus _status) = xAlpacaV2.userUnlockRequests(ALICE, _unlockId);

    assertEq(uint8(_status), 2);
    assertEq(xAlpacaV2.totalLocked(), 10 ether);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), 10 ether);

    vm.stopPrank();
  }
}
