// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_WithdrawWithRewarderTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();

    setupRewarder();
  }

  function testCorrectness_WhenWithdraw_RewarderUserInfoShouldBeCorrect() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);
    vm.stopPrank();

    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);

    vm.prank(ALICE);
    revenueDistributor.withdraw(ALICE, 5 ether);

    // assert alice balance
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBalanceBefore, 5 ether);

    // assert total staking amount
    (uint256 _totalAmount, ) = revenueDistributor.userInfo(ALICE);
    assertEq(_totalAmount, 5 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, 5 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, 5 ether, 0);
  }
}
