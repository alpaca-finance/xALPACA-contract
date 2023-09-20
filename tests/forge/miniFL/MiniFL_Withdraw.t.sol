// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_WithdrawTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
    setupMiniFLPool();
  }

  // #withdraw ibToken (not debt token)
  function testCorrectness_WhenWithdrawAmountThatCoveredByBalance() external {
    // alice deposited
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);

    vm.prank(ALICE);
    miniFL.withdraw(ALICE, wethPoolID, 5 ether);

    assertEq(weth.balanceOf(ALICE) - _aliceWethBalanceBefore, 5 ether);

    // check reserve amount
    assertStakingReserve(wethPoolID, 5 ether);
  }

  function testCorrectness_WhenFunderWithdrawFromMiniFL() external {
    uint256 _aliceDepoisitAmount = 10 ether;

    // alice deposited
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), _aliceDepoisitAmount);
    miniFL.deposit(ALICE, wethPoolID, _aliceDepoisitAmount);
    vm.stopPrank();

    // bob deposited
    vm.startPrank(BOB);
    weth.approve(address(miniFL), 5 ether);
    miniFL.deposit(BOB, wethPoolID, 5 ether);
    vm.stopPrank();

    // funder deposit for alice
    vm.prank(funder1);
    miniFL.deposit(ALICE, wethPoolID, 15 ether);

    vm.prank(funder2);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);

    // just correct staking total amount
    assertTotalUserStakingAmount(ALICE, wethPoolID, 35 ether);

    // cache balance before withdraw
    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);
    uint256 _funder1WethBalanceBefore = weth.balanceOf(funder1);
    uint256 _funder2WethBalanceBefore = weth.balanceOf(funder2);

    // funder1 withdraw some
    vm.prank(funder1);
    miniFL.withdraw(ALICE, wethPoolID, 10 ether);

    // funder2 also withdraw some
    vm.prank(funder2);
    miniFL.withdraw(ALICE, wethPoolID, 8 ether);

    // check balance after withdraw
    // ALICE balance should not changed
    assertEq(weth.balanceOf(ALICE) - _aliceWethBalanceBefore, 0);
    assertEq(weth.balanceOf(funder1) - _funder1WethBalanceBefore, 10 ether);
    assertEq(weth.balanceOf(funder2) - _funder2WethBalanceBefore, 8 ether);

    // check staking amount per funder
    // ALICE staking amount should not affected when funder withdraw
    assertFunderAmount(ALICE, ALICE, wethPoolID, _aliceDepoisitAmount);
    assertFunderAmount(funder1, ALICE, wethPoolID, 5 ether);
    assertFunderAmount(funder2, ALICE, wethPoolID, 2 ether);

    // ALICE total staking amount 35 - 18 = 17
    assertTotalUserStakingAmount(ALICE, wethPoolID, 17 ether);

    // check reserve amount total of alice 17, and bob 5
    assertStakingReserve(wethPoolID, 22 ether);
  }

  function testRevert_WhenAliceWithdrawFromAmountOfFunder() external {
    // funder deposit for alice
    vm.prank(funder1);
    miniFL.deposit(ALICE, wethPoolID, 15 ether);

    // fund of funder must withdraw by funder
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InsufficientFundedAmount.selector));
    miniFL.withdraw(ALICE, wethPoolID, 10 ether);
  }

  function testRevert_WhenCallerWithdrawWithExceedAmount() external {
    // alice deposited
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    // funder deposit for alice
    vm.prank(funder1);
    miniFL.deposit(ALICE, wethPoolID, 15 ether);

    vm.prank(funder2);
    miniFL.deposit(ALICE, wethPoolID, 20 ether);

    // alice could not withdraw more than 10
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InsufficientFundedAmount.selector));
    miniFL.withdraw(ALICE, wethPoolID, 11 ether);

    // funder1 could not withdraw more than 15
    vm.prank(funder1);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InsufficientFundedAmount.selector));
    miniFL.withdraw(ALICE, wethPoolID, 16 ether);

    // funder2 could not withdraw more than 20
    vm.prank(funder2);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InsufficientFundedAmount.selector));
    miniFL.withdraw(ALICE, wethPoolID, 20.1 ether);
  }

  // #withdraw debtToken
  function testCorrectness_WhenWithdrawDebtToken() external {
    // bob deposit on debt token
    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(BOB, mockToken1PoolID, 10 ether);
    vm.stopPrank();

    uint256 _bobDTokenBalanceBefore = mockToken1.balanceOf(BOB);

    vm.prank(BOB);
    miniFL.withdraw(BOB, mockToken1PoolID, 5 ether);

    assertEq(mockToken1.balanceOf(BOB) - _bobDTokenBalanceBefore, 5 ether);
  }

  // staker can withdraw for another
  function testCorrectness_WhenWithdrawDebtTokenForAnother() external {
    // bob deposit on debt token for ALICE
    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, mockToken1PoolID, 10 ether);
    vm.stopPrank();

    uint256 _bobDTokenBalanceBefore = mockToken1.balanceOf(BOB);

    // bob withdraw on debt token for ALICE
    vm.prank(BOB);
    miniFL.withdraw(ALICE, mockToken1PoolID, 5 ether);

    assertEq(mockToken1.balanceOf(BOB) - _bobDTokenBalanceBefore, 5 ether);
    // need to check pending alpaca ??????
  }

  function testRevert_WhenNonWhitelistedCallersWithDrawFromMiniFL() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_Unauthorized.selector));
    miniFL.withdraw(randomCaller, wethPoolID, 10 ether);
    vm.stopPrank();
  }
}
