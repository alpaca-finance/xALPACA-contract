// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { xALPACAV2_BaseTest } from "../base/xALPACAV2_BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_UnlockTest is xALPACAV2_BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    xAlpacaV2.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testRevert_WhenUserWantToTransferMoreThanLocked_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAmount.selector));
    xAlpacaV2.transfer(BOB, 11 ether);

    vm.stopPrank();
  }

  function testRevert_WhenUserWantToTransferToInvalidAddress_ShouldRevert() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAddress.selector));
    xAlpacaV2.transfer(address(0), 10 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAddress.selector));
    xAlpacaV2.transfer(address(xAlpacaV2), 10 ether);

    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_InvalidAddress.selector));
    xAlpacaV2.transfer(address(ALICE), 10 ether);

    vm.stopPrank();
  }

  function testCorrectness_WhenUserTrasnfer_ShouldOnlyTrasnferLockAmount() external {
    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, 10 ether);

    xAlpacaV2.unlock(5 ether);

    xAlpacaV2.transfer(BOB, 5 ether);

    assertEq(xAlpacaV2.userLockAmounts(ALICE), 0);
    assertEq(xAlpacaV2.userLockAmounts(BOB), 5 ether);

    vm.stopPrank();
  }
}
