// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_DepositTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  // #deposit ibToken (not debt token)
  function testCorrectness_WhenDepositMiniFLShouldWork() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    // transfer correctly
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 10 ether);
    // check staking amount for ALICE as funder
    assertFunderAmount(ALICE, ALICE, 10 ether);
    // check total staking amount
    assertTotalUserStakingAmount(ALICE, 10 ether);

    // check reserve amount
    assertStakingReserve(10 ether);
  }

  function testCorrectness_WhenOneFunderDepositMiniFLForAlice() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    uint256 _funder1AlpacaBalanceBefore = alpaca.balanceOf(funder1);
    // funder1 deposit for ALICE
    vm.prank(funder1);
    miniFL.deposit(ALICE, 10 ether);

    // ALICE balance should not changed
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 0);
    assertEq(_funder1AlpacaBalanceBefore - alpaca.balanceOf(funder1), 10 ether);

    // check staking amount per funder
    assertFunderAmount(ALICE, ALICE, 0 ether);
    assertFunderAmount(funder1, ALICE, 10 ether);

    // check total staking amount
    assertTotalUserStakingAmount(ALICE, 10 ether);

    // check reserve amount
    assertStakingReserve(10 ether);
  }

  function testCorrectness_WhenManyFunderDepositMiniFLForAliceAndBob() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    uint256 _funder1AlpacaBalanceBefore = alpaca.balanceOf(funder1);
    uint256 _funder2AlpacaBalanceBefore = alpaca.balanceOf(funder2);

    // funder1 deposit for ALICE
    vm.prank(funder1);
    miniFL.deposit(ALICE, 10 ether);

    // funder2 deposit for ALICE
    vm.prank(funder2);
    miniFL.deposit(ALICE, 11 ether);

    vm.prank(funder2);
    miniFL.deposit(BOB, 12 ether);

    // ALICE balance should not changed
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 0);
    assertEq(_funder1AlpacaBalanceBefore - alpaca.balanceOf(funder1), 10 ether);
    assertEq(_funder2AlpacaBalanceBefore - alpaca.balanceOf(funder2), 23 ether); // 11 for alice, 12 for bob

    // check staking amount per funder
    assertFunderAmount(ALICE, ALICE, 0 ether);
    assertFunderAmount(funder1, ALICE, 10 ether);
    assertFunderAmount(funder2, ALICE, 11 ether);
    assertFunderAmount(funder2, BOB, 12 ether);

    // check total staking amount
    assertTotalUserStakingAmount(ALICE, 21 ether);
    assertTotalUserStakingAmount(BOB, 12 ether);

    // check reserve amount
    assertStakingReserve(33 ether);
  }

  function testRevert_WhenNonWhitelistedCallersDepositMiniFLW() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    alpaca.approve(address(miniFL), 10 ether);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_Unauthorized.selector));
    miniFL.deposit(randomCaller, 10 ether);
    vm.stopPrank();
  }
}
