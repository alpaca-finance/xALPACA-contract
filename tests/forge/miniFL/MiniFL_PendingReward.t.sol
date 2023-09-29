// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_PendingRewardTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
    setupMiniFLPool();
    prepareForHarvest();
  }

  function testCorrectness_WhenTimpast_PendingAlpacaShouldBeCorrect() external {
    // timpast for 100 second
    skip(100);

    // Mini FL, alpaca per second = 1000 ether then distributed reward = 1000 * 100 = 100000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |         60 |    20 |  10 |                 30 |          60000 |                   2000 |
    // | DToken |         40 |    10 |  90 |                100 |          40000 |                    400 |
    // | Total  |        100 |       |     |                    |         100000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Summarize
    // *** Reward Formula: (AMOUNT * ACC PER SHARE) - Reward Debt
    // ALICE Reward
    // ----------------------------
    // |    Pool |  ALPACA Reward |
    // |---------|----------------|
    // |    WETH |          40000 |
    // |  DToken |           4000 |
    // |   Total |          44000 |
    // ----------------------------
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, ALICE), 4000 ether);

    // BOB Reward
    // ----------------------------
    // |    Pool |  ALPACA Reward |
    // |---------|----------------|
    // |    WETH |          20000 |
    // |  DToken |          36000 |
    // |   Total |          56000 |
    // ----------------------------
    assertEq(miniFL.pendingAlpaca(wethPoolID, BOB), 20000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, BOB), 36000 ether);
  }

  function testCorrectness_WhenSomeOneTransferDirectToMiniFL_PendingAlpacaShouldBeCorrect() external {
    // timpast for 100 second
    skip(100);

    // increase balance in MiniFL
    weth.mint(address(miniFL), 10 ether);
    mockToken1.mint(address(miniFL), 10 ether);

    // Mini FL, alpaca per second = 1000 ether then distributed reward = 1000 * 100 = 100000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |         60 |    20 |  10 |                 30 |          60000 |                   2000 |
    // | DToken |         40 |    10 |  90 |                100 |          40000 |                    400 |
    // | Total  |        100 |       |     |                    |         100000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Summarize
    // *** Reward Formula: (AMOUNT * ACC PER SHARE) - Reward Debt
    // ALICE Reward
    // ----------------------------
    // |    Pool |  ALPACA Reward |
    // |---------|----------------|
    // |    WETH |          40000 |
    // |  DToken |           4000 |
    // |   Total |          44000 |
    // ----------------------------
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, ALICE), 4000 ether);

    // BOB Reward
    // ----------------------------
    // |    Pool |  ALPACA Reward |
    // |---------|----------------|
    // |    WETH |          20000 |
    // |  DToken |          36000 |
    // |   Total |          56000 |
    // ----------------------------
    assertEq(miniFL.pendingAlpaca(wethPoolID, BOB), 20000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, BOB), 36000 ether);
  }
}
