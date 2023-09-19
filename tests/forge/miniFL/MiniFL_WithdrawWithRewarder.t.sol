// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_WithdrawWithRewarderTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
    setupMiniFLPool();
    setupRewarder();
  }

  function testCorrectness_WhenWithdraw_RewarderUserInfoShouldBeCorrect() external {
    // alice deposited
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);

    vm.prank(ALICE);
    miniFL.withdraw(ALICE, wethPoolID, 5 ether);

    // assert alice balance
    assertEq(weth.balanceOf(ALICE) - _aliceWethBalanceBefore, 5 ether);

    // assert total staking amount
    assertTotalUserStakingAmount(ALICE, wethPoolID, 5 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, wethPoolID, 5 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, wethPoolID, 5 ether, 0);
  }

  function testCorrectness_WhenFunderWithdrawToken_RewarderUserInfoShouldBeCorrect() external {
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

    // check total amount = 45
    assertTotalUserStakingAmount(ALICE, wethPoolID, 45 ether);

    // balance before withdraw
    uint256 _aliceWethBalanceBefore = weth.balanceOf(ALICE);
    uint256 _funder1WethBalanceBefore = weth.balanceOf(funder1);
    uint256 _funder2WethBalanceBefore = weth.balanceOf(funder2);

    // withdraw
    vm.prank(ALICE);
    miniFL.withdraw(ALICE, wethPoolID, 5 ether);

    vm.prank(funder1);
    miniFL.withdraw(ALICE, wethPoolID, 7 ether);

    vm.prank(funder2);
    miniFL.withdraw(ALICE, wethPoolID, 10 ether);

    // assert received amount
    assertEq(weth.balanceOf(ALICE) - _aliceWethBalanceBefore, 5 ether, "alice balance after withdraw");
    assertEq(weth.balanceOf(funder1) - _funder1WethBalanceBefore, 7 ether, "funder1 balance after withdraw");
    assertEq(weth.balanceOf(funder2) - _funder2WethBalanceBefore, 10 ether, "funder2 balance after withdraw");

    // assert total staking amount after withdraw
    // 45 - 22 = 23
    assertTotalUserStakingAmount(ALICE, wethPoolID, 23 ether);

    // check staking amount per funder
    assertFunderAmount(ALICE, ALICE, wethPoolID, 5 ether); // 10 - 5 = 5
    assertFunderAmount(funder1, ALICE, wethPoolID, 8 ether); // 15 - 7 = 8
    assertFunderAmount(funder2, ALICE, wethPoolID, 10 ether); // 20 - 10 = 10

    // assert state at rewarders
    assertRewarderUserInfo(rewarder1, ALICE, wethPoolID, 23 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, wethPoolID, 23 ether, 0);
  }

  function testCorrectness_WhenWithdrawDebToken_RewarderUserInfoShouldBeCorrect() external {
    // bob deposit on debt token
    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(BOB, mockToken1PoolID, 10 ether);
    vm.stopPrank();

    uint256 _bobDTokenBalanceBefore = mockToken1.balanceOf(BOB);

    vm.prank(BOB);
    miniFL.withdraw(BOB, mockToken1PoolID, 5 ether);

    // assert bob balance
    assertEq(mockToken1.balanceOf(BOB) - _bobDTokenBalanceBefore, 5 ether);

    // assert total staking amount
    assertTotalUserStakingAmount(BOB, mockToken1PoolID, 5 ether);

    // assert reward user info
    assertRewarderUserInfo(rewarder1, BOB, mockToken1PoolID, 5 ether, 0);
    // rewarder2 is not register in this pool then user amount should be 0
    assertRewarderUserInfo(rewarder2, BOB, mockToken1PoolID, 0 ether, 0);
  }
}
