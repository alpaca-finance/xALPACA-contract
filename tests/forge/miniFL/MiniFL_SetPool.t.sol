// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_SetPoolTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenSetPool() external {
    // PID 0 = dummy pool
    miniFL.addPool(100, address(weth), false); // PID 1
    miniFL.addPool(50, address(usdc), false); // PID 2

    assertEq(miniFL.poolLength(), 3);
    assertEq(miniFL.totalAllocPoint(), 150);

    miniFL.setPool(1, 150, false);

    assertEq(miniFL.poolLength(), 3);
    assertEq(miniFL.totalAllocPoint(), 200);
  }

  function testRevert_WhenSetPoolWithDummyPoolId() external {
    // PID 0 = dummy pool
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_InvalidArguments.selector));
    miniFL.setPool(0, 100, true);
  }
}
