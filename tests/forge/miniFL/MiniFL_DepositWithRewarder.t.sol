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
    setupRewarder();
  }

  function testCorrectness_WhenDeposit_RewarderUserInfoShouldBeCorrect() external {
    uint256 _aliceAlpacaBalanceBefore = alpaca.balanceOf(ALICE);
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    // assert alice balance
    assertEq(_aliceAlpacaBalanceBefore - alpaca.balanceOf(ALICE), 10 ether);

    // assert reward user info, both user info should be same
    assertRewarderUserInfo(rewarder1, ALICE, 10 ether, 0);
    assertRewarderUserInfo(rewarder2, ALICE, 10 ether, 0);
  }
}
