// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "../base/BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_CancelUnlockTest is BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    console.log(xALPACA.owner());
    xALPACA.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToCancelClaimedUnlock_ShouldRevert() external {
    vm.startPrank(ALICE);

    assertTrue(false);

    vm.stopPrank();
  }

  function testCorrectness_WhenUserCancel_UnclaimedUnlock_ShouldWork() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(10 ether);

    uint256 _unlockId = xALPACA.unlock(4 ether);

    xALPACA.cancelUnlock(_unlockId);
    (, , uint8 _status) = xALPACA.userUnlockRequests(ALICE, _unlockId);

    // todo: change to enum
    assertEq(_status, 2);
    assertEq(xALPACA.totalLocked(), 10 ether);
    assertEq(xALPACA.userLockAmounts(ALICE), 10 ether);

    vm.stopPrank();
  }
}
