// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_WithdrawTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenWithdrawAmountThatCoveredByBalance() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);
    vm.stopPrank();

    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);

    vm.prank(ALICE);
    revenueDistributor.withdraw(ALICE, 5 ether);

    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBalanceBefore, 5 ether);

    // check reserve amount
    assertStakingReserve(5 ether);
  }

  function testRevert_WhenWithdrawMoreThanDeposit() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);
    vm.stopPrank();

    vm.prank(ALICE);
    vm.expectRevert(
      abi.encodeWithSelector(IxALPACAv2RevenueDistributor.xALPACAv2RevenueDistributor_InsufficientAmount.selector)
    );
    revenueDistributor.withdraw(ALICE, 11 ether);
  }

  function testRevert_WhenNonWhitelistedCallersWithDrawFromxALPACAv2RevenueDistributor() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    vm.expectRevert(
      abi.encodeWithSelector(IxALPACAv2RevenueDistributor.xALPACAv2RevenueDistributor_Unauthorized.selector)
    );
    revenueDistributor.withdraw(randomCaller, 10 ether);
    vm.stopPrank();
  }
}
