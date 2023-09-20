// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_PendingRewardWithRewarderTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
    setupMiniFLPool();
    setupRewarder();

    prepareForHarvest();
  }

  function testCorrectness_WhenTimpast_RewarderPendingTokenShouldBeCorrectly() external {
    // timpast for 100 second
    vm.warp(block.timestamp + 100);

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

    // Rewarder1 Info, reward per second = 100 ether then distributed reward = 100 * 100 = 10000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |         90 |    20 |  10 |                 30 |           9000 |                    300 |
    // | DToken |         10 |    10 |  90 |                100 |           1000 |                     10 |
    // | Total  |        100 |       |     |                    |          10000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Rewarder2 Info, reward per second = 200 ether then distributed reward = 150 * 100 = 15000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |        100 |    20 |  10 |                 30 |          15000 |                    500 |
    // | Total  |        100 |       |     |                    |          15000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Summarize
    // *** Reward Formula: (AMOUNT * ACC PER SHARE) - Reward Debt
    // ALICE Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          40000 |           6000 |          10000 |
    // |  DToken |           4000 |            100 |              0 |
    // |   Total |          44000 |           6100 |          10000 |
    // --------------------------------------------------------------
    // BOB Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          20000 |           3000 |           5000 |
    // |  DToken |          36000 |            900 |              0 |
    // |   Total |          56000 |           3900 |           5000 |
    // --------------------------------------------------------------

    // ALPACA Reward should not be changed
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    assertEq(miniFL.pendingAlpaca(wethPoolID, BOB), 20000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, ALICE), 4000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, BOB), 36000 ether);

    assertEq(rewarder1.pendingToken(wethPoolID, ALICE), 6000 ether);
    assertEq(rewarder1.pendingToken(wethPoolID, BOB), 3000 ether);
    assertEq(rewarder1.pendingToken(mockToken1PoolID, ALICE), 100 ether);
    assertEq(rewarder1.pendingToken(mockToken1PoolID, BOB), 900 ether);

    assertEq(rewarder2.pendingToken(wethPoolID, ALICE), 10000 ether);
    assertEq(rewarder2.pendingToken(wethPoolID, BOB), 5000 ether);
    assertEq(rewarder2.pendingToken(mockToken1PoolID, ALICE), 0 ether);
    assertEq(rewarder2.pendingToken(mockToken1PoolID, BOB), 0 ether);
  }

  function testCorrectness_WhenSomeOneTransferDirectToMiniFLOrRewarder_RewarderPendingTokenShouldBeCorrectly()
    external
  {
    // timpast for 100 second
    vm.warp(block.timestamp + 100);

    // increase balance in MiniFL
    weth.mint(address(miniFL), 10 ether);
    mockToken1.mint(address(miniFL), 10 ether);
    weth.mint(address(rewarder1), 10 ether);
    mockToken1.mint(address(rewarder1), 10 ether);
    weth.mint(address(rewarder2), 10 ether);

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

    // Rewarder1 Info, reward per second = 100 ether then distributed reward = 100 * 100 = 10000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |         90 |    20 |  10 |                 30 |           9000 |                    300 |
    // | DToken |         10 |    10 |  90 |                100 |           1000 |                     10 |
    // | Total  |        100 |       |     |                    |          10000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Rewarder2 Info, reward per second = 200 ether then distributed reward = 150 * 100 = 15000 ether
    // ----------------------------------------------------------------------------------------------------
    // | Pool   | AllocPoint | ALICE | BOB | Total Staked Token | Reward Amount* | ACC Reward per Share** |
    // |--------|------------|-------|-----|--------------------|----------------|------------------------|
    // | WETH   |        100 |    20 |  10 |                 30 |          15000 |                    500 |
    // | Total  |        100 |       |     |                    |          15000 |                        |
    // ----------------------------------------------------------------------------------------------------
    // * distributedReward * alloc point / total alloc point
    // ** Reward amount / Total Staked Token

    // Summarize
    // *** Reward Formula: (AMOUNT * ACC PER SHARE) - Reward Debt
    // ALICE Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          40000 |           6000 |          10000 |
    // |  DToken |           4000 |            100 |              0 |
    // |   Total |          44000 |           6100 |          10000 |
    // --------------------------------------------------------------
    // BOB Reward
    // --------------------------------------------------------------
    // |    Pool |  ALPACA Reward | Reward Token 1 | Reward Token 2 |
    // |---------|----------------|----------------|----------------|
    // |    WETH |          20000 |           3000 |           5000 |
    // |  DToken |          36000 |            900 |              0 |
    // |   Total |          56000 |           3900 |           5000 |
    // --------------------------------------------------------------

    // ALPACA Reward should not be changed
    assertEq(miniFL.pendingAlpaca(wethPoolID, ALICE), 40000 ether);
    assertEq(miniFL.pendingAlpaca(wethPoolID, BOB), 20000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, ALICE), 4000 ether);
    assertEq(miniFL.pendingAlpaca(mockToken1PoolID, BOB), 36000 ether);

    assertEq(rewarder1.pendingToken(wethPoolID, ALICE), 6000 ether);
    assertEq(rewarder1.pendingToken(wethPoolID, BOB), 3000 ether);
    assertEq(rewarder1.pendingToken(mockToken1PoolID, ALICE), 100 ether);
    assertEq(rewarder1.pendingToken(mockToken1PoolID, BOB), 900 ether);

    assertEq(rewarder2.pendingToken(wethPoolID, ALICE), 10000 ether);
    assertEq(rewarder2.pendingToken(wethPoolID, BOB), 5000 ether);
    assertEq(rewarder2.pendingToken(mockToken1PoolID, ALICE), 0 ether);
    assertEq(rewarder2.pendingToken(mockToken1PoolID, BOB), 0 ether);
  }
}
