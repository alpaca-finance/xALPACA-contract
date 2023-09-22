// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "../base/BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_WithdrawTest is BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    console.log(xALPACA.owner());
    xALPACA.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToWithdrawBeforeUnlockCompleted_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(10 ether);
    uint256 _unlockId = xALPACA.unlock(4 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_UnlockTimeUnreached.selector));
    xALPACA.withdraw(_unlockId);
    vm.stopPrank();
  }

  function testCorrectness_WhenUserWithdrawAfterUnlockTimePassed_ShouldWork() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(10 ether);

    uint256 _unlockId = xALPACA.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xALPACA.withdraw(_unlockId);

    assertEq(alpaca.balanceOf(ALICE), 94 ether); // start at 100, lock 10, unlock 4, result in 94
    vm.stopPrank();
  }

  function testRevert_WhenUserTryToWithdrawAgain_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(10 ether);

    uint256 _unlockId = xALPACA.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xALPACA.withdraw(_unlockId);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidStatus.selector));
    xALPACA.withdraw(_unlockId);

    vm.stopPrank();
  }

  function testRevert_WhenUserHasCanceledButTryToWithdraw_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(10 ether);

    uint256 _unlockId = xALPACA.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xALPACA.cancelUnlock(_unlockId);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidStatus.selector));
    xALPACA.withdraw(_unlockId);

    vm.stopPrank();
  }
}
