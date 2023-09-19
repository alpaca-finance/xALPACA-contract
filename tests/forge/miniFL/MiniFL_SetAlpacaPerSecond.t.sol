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

  function testCorrectness_WhenSetAlpacaPerSecond() external {
    // set from base test as max
    assertEq(miniFL.alpacaPerSecond(), maxAlpacaPerSecond);

    miniFL.setAlpacaPerSecond(500 ether, false);
    assertEq(miniFL.alpacaPerSecond(), 500 ether);
  }

  function testRevert_WhenSetAlpacaPerSecondMoreThanMaximum() external {
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InvalidArguments.selector));
    miniFL.setAlpacaPerSecond(maxAlpacaPerSecond + 1, false);
  }
}
