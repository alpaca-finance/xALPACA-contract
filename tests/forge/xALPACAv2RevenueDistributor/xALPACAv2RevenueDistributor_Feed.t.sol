// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";
import { IxALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2Rewarder.sol";

contract xALPACAv2RevenueDistributor_FeedTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenRewardEndedAndSetAlpacaPerSecond_ShouldNotRollOver() external {
    // set from base test as max
    assertEq(revenueDistributor.alpacaPerSecond(), maxAlpacaPerSecond);
    skip(100);
    // 500 per second ether for 100 second
    revenueDistributor.feed(500 ether * 100, block.timestamp + 100);
    assertEq(revenueDistributor.alpacaPerSecond(), 500 ether);
  }

  function testCorrectness_WhenPreviousRewardHasNotEnd_ShouldRollover() external {
    // there's 50 second until reward end
    // with 1000 ether per sec, there's 50000 left
    // trying to feed 10000 ether more for the next 100 seconds
    // should result in 50000 + 10000 / 150 = 400 ether per sec

    skip(50);

    revenueDistributor.feed(10000 ether, block.timestamp + 100);

    assertEq(revenueDistributor.alpacaPerSecond(), 600 ether);
  }

  function testCorrectness_WhenFeedWithEarlierEndRewardTimeWithoutNewAmount_ShouldRecalculate() external {
    // total reward = 1000 * 100 = 100_000
    // remaining reward = 100_000 - (1000*50) = 50_000
    // reduce the time to end 30 second earlier
    // reward per sec should equals 50_000 / 20 s = 2500 per sec

    skip(50);

    revenueDistributor.feed(0, block.timestamp + 20);

    assertEq(revenueDistributor.alpacaPerSecond(), 2500 ether);
  }

  function testCorrectness_WhenFeedWithEarlierEndRewardTimeWithNewAmount_ShouldRecalculate() external {
    // total reward = 1000 * 100 = 100_000
    // remaining reward = 100_000 - (1000*50) = 50_000
    // reduce the time to end 30 second earlier
    // reward per sec should equals 50_000 + 10_000 / 20 s = 3000 per sec

    skip(50);

    revenueDistributor.feed(10000 ether, block.timestamp + 20);

    assertEq(revenueDistributor.alpacaPerSecond(), 3000 ether);
  }

  function testRevert_WhenFeedRewardWithTimestampInThePast_ShouldRevert() external {
    skip(100);
    vm.expectRevert(
      abi.encodeWithSelector(IxALPACAv2RevenueDistributor.xALPACAv2RevenueDistributor_InvalidArguments.selector)
    );
    revenueDistributor.feed(10000 ether, block.timestamp);
  }
}
