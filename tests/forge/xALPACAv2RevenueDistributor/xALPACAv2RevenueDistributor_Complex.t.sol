// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest, console } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";
import { IxALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2Rewarder.sol";

import { xALPACAv2RevenueDistributor } from "contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_ComplexTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
    setupRewarder();
  }

  // 1. ALICE deposits after block.timestamp > rewardEndTimestamp
  // 2. wait for sometime passed
  // 3. BOB and CAT deposit agian
  function testCorrectness_Complex1() external {
    skip(200);
    assert(block.timestamp > revenueDistributor.rewardEndTimestamp());
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);

    (uint256 accAlpacaPerShareBefore, ) = revenueDistributor.poolInfo();
    (uint256 rewarder1RewardPerShareBefore, ) = rewarder1.poolInfo();
    (uint256 rewarder2RewardPerShareBefore, ) = rewarder2.poolInfo();

    skip(100);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);

    (uint256 accAlpacaPerShareAfter, uint64 lastRewardTimeAfter) = revenueDistributor.poolInfo();
    (uint256 rewarder1RewardPerShareAfter, uint64 rewarder1lastRewardTimeAfter) = rewarder1.poolInfo();
    (uint256 rewarder2RewardPerShareAfter, uint64 rewarder2lastRewardTimeAfter) = rewarder2.poolInfo();

    assertEq(accAlpacaPerShareAfter, accAlpacaPerShareBefore);
    assertEq(lastRewardTimeAfter, block.timestamp);

    assertEq(rewarder1RewardPerShareAfter, rewarder1RewardPerShareBefore);
    assertEq(rewarder1lastRewardTimeAfter, block.timestamp);

    assertEq(rewarder2RewardPerShareAfter, rewarder2RewardPerShareBefore);
    assertEq(rewarder2lastRewardTimeAfter, block.timestamp);
  }

  // 1. ALICE deposits after block.timestamp > rewardEndTimestamp
  // 2. wait for sometime passed
  // 3. call ALICE's pendingAlpaca
  function testCorrectness_Complex2() external {
    skip(200);
    assert(block.timestamp > revenueDistributor.rewardEndTimestamp());
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(ALICE, 10 ether);

    skip(100);
    revenueDistributor.pendingAlpaca(ALICE);
    rewarder1.pendingToken(ALICE);
    rewarder2.pendingToken(ALICE);
  }
}
