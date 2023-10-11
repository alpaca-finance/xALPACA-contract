// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { xALPACAV2_BaseTest } from "../base/xALPACAV2_BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_WithdrawTest is xALPACAV2_BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    xAlpacaV2.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToWithdrawBeforeUnlockCompleted_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);
    uint256 _unlockId = xAlpacaV2.unlock(4 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_UnlockTimeUnreached.selector));
    xAlpacaV2.withdraw(_unlockId);
    vm.stopPrank();
  }

  function testRevert_WhenUserTryToWithdrawAgain_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    uint256 _unlockId = xAlpacaV2.unlock(4 ether);

    skip(DELAY_UNLOCK_TIME);

    xAlpacaV2.withdraw(_unlockId);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidStatus.selector));
    xAlpacaV2.withdraw(_unlockId);

    vm.stopPrank();
  }

  function testRevert_WhenUserHasCanceledButTryToWithdraw_ShouldRevert() external {
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

  function testCorrectness_WhenUserWithdrawAfterUnlockTimePassed_ShouldWork() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, _lockAmount);

    uint256 _unlockId = xAlpacaV2.unlock(_unlockAmount);

    skip(DELAY_UNLOCK_TIME);

    xAlpacaV2.withdraw(_unlockId);

    assertEq(alpaca.balanceOf(ALICE), _startingBalance - _lockAmount + _unlockAmount); // start at 100, lock 10, unlock 4, result in 94
    vm.stopPrank();
  }

  function testCorrectness_WhenUserEarlyWithdraw_UserShouldPayFee() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;
    uint256 _earlyWithdrawFeeBpsPerDay = 50;
    // 50 bps per day
    xAlpacaV2.setEarlyWithdrawFeeBpsPerDay(_earlyWithdrawFeeBpsPerDay);

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, _lockAmount);

    uint256 _unlockId = xAlpacaV2.unlock(_unlockAmount);

    skip(20.5 days);

    xAlpacaV2.earlyWithdraw(_unlockId);

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
    xAlpacaV2.setEarlyWithdrawFeeBpsPerDay(_earlyWithdrawFeeBpsPerDay);

    uint256 _startingBalance = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, _lockAmount);

    uint256 _unlockId = xAlpacaV2.unlock(_unlockAmount);

    vm.stopPrank();

    xAlpacaV2.setBreaker(1);

    vm.startPrank(ALICE);
    xAlpacaV2.earlyWithdraw(_unlockId);

    assertEq(alpaca.balanceOf(ALICE), _startingBalance - _lockAmount + _unlockAmount); // start at 100, lock 10, unlock 4, result in 94
    assertEq(alpaca.balanceOf(treasury), 0);
    vm.stopPrank();
  }
}
