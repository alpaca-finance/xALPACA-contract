// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

import { xALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2Rewarder.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_DepositWithRewarderTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
    setupRewarder();
  }

  function testCorrectness_WhenDeposit_RewarderUserInfoShouldBeCorrect() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);
    vm.stopPrank();

    // assert alice balance
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 10 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, 10 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, 10 ether, 0);
  }
}
