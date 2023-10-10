// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "../base/BaseTest.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_LockTest is BaseTest {
  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
  }

  function testCorrectness_WhenUserLockAlpacaToken_StateShouldUpdatedCorrectly() external {
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    uint256 _bobAlpacaBefore = alpaca.balanceOf(BOB);

    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 1 ether);

    vm.stopPrank();

    vm.startPrank(BOB);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(BOB, 2 ether);

    vm.stopPrank();

    uint256 _aliceAlpacaLocked = _aliceAlpacaBefore - alpaca.balanceOf(ALICE);
    uint256 _bobAlpacaLocked = _bobAlpacaBefore - alpaca.balanceOf(BOB);
    // assert user's balance
    assertEq(_aliceAlpacaLocked, 1 ether);
    assertEq(_bobAlpacaLocked, 2 ether);

    // assert xALPACA's state
    assertEq(xAlpacaV2.totalLocked(), 3 ether);
    assertEq(xAlpacaV2.userLockAmounts(ALICE), 1 ether);
    assertEq(xAlpacaV2.userLockAmounts(BOB), 2 ether);
  }
}
