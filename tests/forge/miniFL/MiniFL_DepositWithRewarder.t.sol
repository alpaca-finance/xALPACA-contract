// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

import { Rewarder } from "../../../contracts/8.19/miniFL/Rewarder.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_DepositWithRewarderTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
    setupMiniFLPool();
    setupRewarder();
  }

  function testCorrectness_WhenDeposit_RewarderUserInfoShouldBeCorrect() external {
    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    // assert alice balance
    assertEq(_aliceWethBalanceBefore - weth.balanceOf(ALICE), 10 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, wethPoolID, 10 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, wethPoolID, 10 ether, 0);
  }

  function testCorrectness_WhenDepositDebtToken_RewarderUserInfoShouldBeCorrect() external {
    uint256 _bobDebtTokenBalanceBefore = mockToken1.balanceOf(BOB);

    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(BOB, mockToken1PoolID, 10 ether);
    vm.stopPrank();

    // assert bob balance
    assertEq(_bobDebtTokenBalanceBefore - mockToken1.balanceOf(BOB), 10 ether);

    // assert reward user info
    assertRewarderUserInfo(rewarder1, BOB, mockToken1PoolID, 10 ether, 0);
    // rewarder2 is not register in this pool then user amount should be 0
    assertRewarderUserInfo(rewarder2, BOB, mockToken1PoolID, 0, 0);
  }

  function testCorrectness_WhenFunderDeposit_RewarderUserInfoShouldBeCorrect() external {
    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);
    uint256 _funder1WethBalanceBefore = weth.balanceOf(funder1);
    uint256 _funder2WethBalanceBefore = weth.balanceOf(funder2);
    // alice deposit for self
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    // funder1 deposit for alice
    vm.prank(funder1);
    miniFL.deposit(ALICE, wethPoolID, 11 ether);

    // funder1 deposit for alice
    vm.prank(funder2);
    miniFL.deposit(ALICE, wethPoolID, 12 ether);

    // assert alice balance
    assertEq(_aliceWethBalanceBefore - weth.balanceOf(ALICE), 10 ether);
    assertEq(_funder1WethBalanceBefore - weth.balanceOf(funder1), 11 ether);
    assertEq(_funder2WethBalanceBefore - weth.balanceOf(funder2), 12 ether);

    // check staking amount per funder
    assertFunderAmount(ALICE, ALICE, wethPoolID, 10 ether);
    assertFunderAmount(funder1, ALICE, wethPoolID, 11 ether);
    assertFunderAmount(funder2, ALICE, wethPoolID, 12 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, wethPoolID, 33 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, wethPoolID, 33 ether, 0);
  }
}
