// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_SetMaxAlpacaPerSecondTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenSetMaxAlpacaPerSecond() external {
    // set from base test as max
    assertEq(miniFL.maxAlpacaPerSecond(), maxAlpacaPerSecond);

    miniFL.setMaxAlpacaPerSecond(maxAlpacaPerSecond * 2);
    assertEq(miniFL.maxAlpacaPerSecond(), maxAlpacaPerSecond * 2);
  }

  function testCorrectness_WhenSetAlpacaPerSecondMoreThanButExtendMaxAlpacaPerSecond() external {
    // first maximum is 1000 ether
    uint256 _newAlpacaPerSec = 1500 ether;

    // ensure this new alpaca per sec should be reverted
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InvalidArguments.selector));
    miniFL.setAlpacaPerSecond(_newAlpacaPerSec, type(uint256).max, false);

    miniFL.setMaxAlpacaPerSecond(maxAlpacaPerSecond * 2);
    miniFL.setAlpacaPerSecond(_newAlpacaPerSec, type(uint256).max, false);
    assertEq(miniFL.alpacaPerSecond(), _newAlpacaPerSec);
  }

  function testRevert_WhenSetMaxAlpacaLessThanCurrentAlpacaPerSecond() external {
    // from base test, max alpaca per second and alpaca per second is 1000 ether
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InvalidArguments.selector));
    miniFL.setMaxAlpacaPerSecond(100 ether);
  }
}
