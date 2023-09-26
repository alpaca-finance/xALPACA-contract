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

  function testCorrectness_WhenUserWithdrawAfterUnlockTimePassed_ShouldWork() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(_lockAmount);

    uint256 _unlockId = xALPACA.unlock(_unlockAmount);

    skip(DELAY_UNLOCK_TIME);

    xALPACA.withdraw(_unlockId);

    assertEq(alpaca.balanceOf(ALICE), _startingBalance - _lockAmount + _unlockAmount); // start at 100, lock 10, unlock 4, result in 94
    vm.stopPrank();
  }

  function testCorrectness_WhenUserEarlyWithdraw_UserShouldPayFee() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;
    uint256 _earlyWithdrawFeeBpsPerDay = 50;
    // 50 bps per day
    xALPACA.setEarlyWithdrawFeeBpsPerDay(_earlyWithdrawFeeBpsPerDay);

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(_lockAmount);

    uint256 _unlockId = xALPACA.unlock(_unlockAmount);

    skip(20.5 days);

    xALPACA.earlyWithdraw(_unlockId);

    uint256 _fee = (_unlockAmount * (_earlyWithdrawFeeBpsPerDay / 2)) / 10000;

    assertEq(alpaca.balanceOf(ALICE), _startingBalance - _lockAmount + _unlockAmount - _fee); // start at 100, lock 10, unlock 4, result in 94
    assertEq(alpaca.balanceOf(treasury), _fee);
    vm.stopPrank();
  }

  function testCorrectness_WhenUserEarlyWithdrawAndBreakerIsOn_ShouldHaveNoFee() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;
    uint256 _earlyWithdrawFeeBpsPerDay = 50;
    // 50 bps per day
    xALPACA.setEarlyWithdrawFeeBpsPerDay(_earlyWithdrawFeeBpsPerDay);

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(_lockAmount);

    uint256 _unlockId = xALPACA.unlock(_unlockAmount);

    vm.stopPrank();

    xALPACA.setBreaker(1);

    vm.startPrank(ALICE);
    xALPACA.earlyWithdraw(_unlockId);

    assertEq(alpaca.balanceOf(ALICE), _startingBalance - _lockAmount + _unlockAmount); // start at 100, lock 10, unlock 4, result in 94
    assertEq(alpaca.balanceOf(treasury), 0);
    vm.stopPrank();
  }
}
