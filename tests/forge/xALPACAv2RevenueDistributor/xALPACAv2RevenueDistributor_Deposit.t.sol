// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";
import { IxALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2Rewarder.sol";

contract xALPACAv2RevenueDistributor_DepositTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  // #deposit ibToken (not debt token)
  function testCorrectness_WhenDepositxALPACAv2RevenueDistributorShouldWork() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);
    vm.stopPrank();

    // transfer correctly
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 10 ether);
    // check total staking amount
    (uint256 _totalAmount, ) = revenueDistributor.userInfo(ALICE);
    assertEq(_totalAmount, 10 ether);

    // check reserve amount
    assertStakingReserve(10 ether);
  }

  function testRevert_WhenNonWhitelistedCallersDepositrevenueDistributor() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    alpaca.approve(address(revenueDistributor), 10 ether);
    vm.expectRevert(
      abi.encodeWithSelector(IxALPACAv2RevenueDistributor.xALPACAv2RevenueDistributor_Unauthorized.selector)
    );
    revenueDistributor.deposit(randomCaller, 10 ether);
    vm.stopPrank();
  }
}
