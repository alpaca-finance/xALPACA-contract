// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest, console } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_HarvestWithRewarderTest is MiniFL_BaseTest {
  uint256 _aliceTotalWethDeposited = 20 ether;
  uint256 _aliceDTokenDeposited = 10 ether;

  uint256 _bobTotalWethDeposited = 10 ether;
  uint256 _bobDTokenDeposited = 90 ether;

  function setUp() public override {
    super.setUp();

    setupRewarder();
  }

  function testCorrectness_MutipleStakersWithMultipleRewarders_ShouldAllocateCorrectly() external {
    vm.startPrank(ALICE);
    alpaca.approve(address(miniFL), 100 ether);
    miniFL.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    uint256 _aliceRewardToken1Before = rewardToken1.balanceOf(ALICE);
    uint256 _aliceRewardToken2Before = rewardToken2.balanceOf(ALICE);
    miniFL.harvest();

    // 1000 per sec
    // 1000 * 50
    assertEq(rewardToken1.balanceOf(ALICE) - _aliceRewardToken1Before, 5000 ether);
    assertEq(rewardToken2.balanceOf(ALICE) - _aliceRewardToken2Before, 7500 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(miniFL), 100 ether);
    miniFL.deposit(BOB, 100 ether);

    skip(50);

    uint256 _bobRewardToken1Before = rewardToken1.balanceOf(BOB);
    uint256 _bobRewardToken2Before = rewardToken2.balanceOf(BOB);

    miniFL.harvest();

    assertEq(rewardToken1.balanceOf(BOB) - _bobRewardToken1Before, 2500 ether);
    assertEq(rewardToken2.balanceOf(BOB) - _bobRewardToken2Before, 3750 ether);
    vm.stopPrank();
  }
}
