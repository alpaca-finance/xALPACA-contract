// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_WithdrawTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  // #withdraw ibToken (not debt token)
  function testCorrectness_WhenWithdrawAmountThatCoveredByBalance() external {
    // alice deposited
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);

    vm.prank(ALICE);
    miniFL.withdraw(ALICE, 5 ether);

    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBalanceBefore, 5 ether);

    // check reserve amount
    assertStakingReserve(5 ether);
  }

  function testRevert_WhenNonWhitelistedCallersWithDrawFromMiniFL() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_Unauthorized.selector));
    miniFL.withdraw(randomCaller, 10 ether);
    vm.stopPrank();
  }
}
