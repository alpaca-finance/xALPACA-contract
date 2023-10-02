// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest, console } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_HarvestTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_MutipleStakers_ShouldAllocateCorrectly() external {
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 100 ether);
    miniFL.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    miniFL.harvest();

    // 1000 per sec
    // 1000 * 50
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 50000 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(miniFL), 100 ether);
    miniFL.deposit(BOB, 100 ether);
    vm.stopPrank();
  }
}
