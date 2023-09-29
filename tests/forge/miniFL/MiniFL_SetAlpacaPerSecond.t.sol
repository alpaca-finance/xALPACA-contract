// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_SetAlpacaPerSecondTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenRewardEndedAndSetAlpacaPerSecond_ShouldNotRollOver() external {
    // set from base test as max
    assertEq(miniFL.alpacaPerSecond(), maxAlpacaPerSecond);
    skip(100);
    // 500 per second ether for 100 second
    miniFL.feed(500 ether * 100, 100);
    assertEq(miniFL.alpacaPerSecond(), 500 ether);
  }

  function testCorrectness_WhenPreviousRewardHasNotEnd_ShouldRollover() external {
    // there's 50 second until reward end
    // with 1000 ether per sec, there's 50000 left
    // trying to feed 10000 ether more for the next 100 seconds
    // should result in 50000 + 10000 / 150 = 400 ether per sec

    skip(50);

    miniFL.feed(10000 ether, 100);

    assertEq(miniFL.alpacaPerSecond(), 600 ether);
  }
}
