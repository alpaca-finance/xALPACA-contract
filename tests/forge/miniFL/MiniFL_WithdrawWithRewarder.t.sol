// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_WithdrawWithRewarderTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();

    setupRewarder();
  }

  function testCorrectness_WhenWithdraw_RewarderUserInfoShouldBeCorrect() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);

    vm.prank(ALICE);
    miniFL.withdraw(ALICE, 5 ether);

    // assert alice balance
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBalanceBefore, 5 ether);

    // assert total staking amount
    assertTotalUserStakingAmount(ALICE, 5 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, 5 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, 5 ether, 0);
  }

  function testCorrectness_WhenFunderWithdrawToken_RewarderUserInfoShouldBeCorrect() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    // funder deposit for alice
    vm.prank(funder1);
    miniFL.deposit(ALICE, 15 ether);

    vm.prank(funder2);
    miniFL.deposit(ALICE, 20 ether);

    // check total amount = 45
    assertTotalUserStakingAmount(ALICE, 45 ether);

    // balance before withdraw
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    uint256 _funder1AlpacaBalanceBefore = alpaca.balanceOf(funder1);
    uint256 _funder2AlpacaBalanceBefore = alpaca.balanceOf(funder2);

    // withdraw
    vm.prank(ALICE);
    miniFL.withdraw(ALICE, 5 ether);

    vm.prank(funder1);
    miniFL.withdraw(ALICE, 7 ether);

    vm.prank(funder2);
    miniFL.withdraw(ALICE, 10 ether);

    // assert received amount
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBalanceBefore, 5 ether, "alice balance after withdraw");
    assertEq(alpaca.balanceOf(funder1) - _funder1AlpacaBalanceBefore, 7 ether, "funder1 balance after withdraw");
    assertEq(alpaca.balanceOf(funder2) - _funder2AlpacaBalanceBefore, 10 ether, "funder2 balance after withdraw");

    // assert total staking amount after withdraw
    // 45 - 22 = 23
    assertTotalUserStakingAmount(ALICE, 23 ether);

    // check staking amount per funder
    assertFunderAmount(ALICE, ALICE, 5 ether); // 10 - 5 = 5
    assertFunderAmount(funder1, ALICE, 8 ether); // 15 - 7 = 8
    assertFunderAmount(funder2, ALICE, 10 ether); // 20 - 10 = 10

    // assert state at rewarders
    assertRewarderUserInfo(rewarder1, ALICE, 23 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, 23 ether, 0);
  }
}
