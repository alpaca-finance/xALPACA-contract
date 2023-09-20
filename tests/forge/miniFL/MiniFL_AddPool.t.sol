// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_AddPoolTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenAddPool() external {
    // pid 0 = dummy pool
    assertEq(miniFL.poolLength(), 1);
    assertEq(miniFL.totalAllocPoint(), 0);

    miniFL.addPool(100, address(weth), false);
    miniFL.addPool(50, address(usdc), false);

    assertEq(miniFL.poolLength(), 3);
    assertEq(miniFL.totalAllocPoint(), 150);
  }

  function testRevert_WhenNonWhitelistedCallersAddPool() external {
    vm.startPrank(CAT);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_Unauthorized.selector));
    miniFL.addPool(100, address(weth), false);
    vm.stopPrank();
  }

  function testRevert_WhenAddDuplicatedStakingTokenPool() external {
    miniFL.addPool(100, address(weth), false);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_DuplicatePool.selector));
    miniFL.addPool(100, address(weth), false);
  }
}
