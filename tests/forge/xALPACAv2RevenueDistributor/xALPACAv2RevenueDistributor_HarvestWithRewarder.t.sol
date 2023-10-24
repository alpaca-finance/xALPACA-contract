// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest, console } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_HarvestWithRewarderTest is xALPACAv2RevenueDistributor_BaseTest {
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
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    uint256 _aliceRewardToken1Before = rewardToken1.balanceOf(ALICE);
    uint256 _aliceRewardToken2Before = rewardToken2.balanceOf(ALICE);
    revenueDistributor.harvest();

    // 1000 per sec
    // 1000 * 50
    assertEq(rewardToken1.balanceOf(ALICE) - _aliceRewardToken1Before, 5000 ether);
    assertEq(rewardToken2.balanceOf(ALICE) - _aliceRewardToken2Before, 7500 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);

    skip(50);

    uint256 _bobRewardToken1Before = rewardToken1.balanceOf(BOB);
    uint256 _bobRewardToken2Before = rewardToken2.balanceOf(BOB);

    revenueDistributor.harvest();

    assertEq(rewardToken1.balanceOf(BOB) - _bobRewardToken1Before, 2500 ether);
    assertEq(rewardToken2.balanceOf(BOB) - _bobRewardToken2Before, 3750 ether);
    vm.stopPrank();
  }

  function testCorrectness_MutipleStakersWithMultipleRewarders_FeedAfterRewardEnded_ShouldAllocateCorrectly() external {
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    vm.stopPrank();

    // skip to 120, reward has stopped at 100
    skip(70);

    // 10 ether per sec
    rewarder1.feed(500 ether, block.timestamp + 50);

    skip(50);

    vm.startPrank(ALICE);
    uint256 _rewardToken1AliceBefore = rewardToken1.balanceOf(ALICE);
    revenueDistributor.harvest();
    // (50 * 100 ether)/2 + (50 * 10)/2 = 2500 + 250 = 2750
    assertEq(rewardToken1.balanceOf(ALICE) - _rewardToken1AliceBefore, 2750 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    uint256 _rewardToken1BobBefore = rewardToken1.balanceOf(BOB);
    revenueDistributor.harvest();
    // (50 * 100 ether)/2 + (50 * 10)/2 = 2500 + 250 = 2750
    assertEq(rewardToken1.balanceOf(BOB) - _rewardToken1BobBefore, 2750 ether);
    vm.stopPrank();
  }

  function testCorrectness_MutipleStakersWithMultipleRewarders_FeedBeforeRewardEnded_ShouldAllocateCorrectly()
    external
  {
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    vm.stopPrank();

    // skip to 70, reward will stop at 100
    skip(20);

    // 10 ether per sec
    rewarder1.feed(500 ether, block.timestamp + 50);

    skip(50);

    vm.startPrank(ALICE);
    uint256 _rewardToken1AliceBefore = rewardToken1.balanceOf(ALICE);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 +(30 * 10)/2 = 25000 + 250 = 25050
    assertEq(rewardToken1.balanceOf(ALICE) - _rewardToken1AliceBefore, 2750 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    uint256 _rewardToken1BobBefore = rewardToken1.balanceOf(BOB);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 + (50 * 10)/2 = 25000 + 250 = 25050
    assertEq(rewardToken1.balanceOf(BOB) - _rewardToken1BobBefore, 2750 ether);
    vm.stopPrank();
  }

  function testCorrectness_DepositBeforeSettingRewarder_ShouldBeEligibleForReward() public {
    // alice deposit before setting rewarder
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    revenueDistributor.addRewarders(address(rewarder3));

    skip(50);

    // bob deposit after setting rewarder
    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    vm.stopPrank();

    uint256 rewardAmount = 100 ether;
    rewardToken3.mint(address(this), rewardAmount);
    rewardToken3.approve(address(rewarder3), rewardAmount);
    rewarder3.feed(rewardAmount, block.timestamp + 100);

    skip(100);

    uint256 _alicePendingReward = rewarder3.pendingToken(ALICE);
    uint256 _bobPendingReward = rewarder3.pendingToken(BOB);

    assertEq(_alicePendingReward, 50 ether);
    assertEq(_bobPendingReward, 50 ether);

    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    revenueDistributor.harvest();
    vm.stopPrank();

    uint256 _aliceBalanceAfter = rewardToken3.balanceOf(ALICE);
    uint256 _bobBalanceAfter = rewardToken3.balanceOf(BOB);
    assertEq(_aliceBalanceAfter, 50 ether);
    assertEq(_bobBalanceAfter, 50 ether);
    assertEq(rewarder3.pendingToken(ALICE), 0);
    assertEq(rewarder3.pendingToken(BOB), 0);
  }

  function testCorrectness_DepositBeforeSettingRewarder_ThenPartialWithdraw_ShouldBeEligibleForCorrectReward() public {
    // alice deposit before setting rewarder
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    revenueDistributor.addRewarders(address(rewarder3));

    skip(50);

    // bob deposit after setting rewarder
    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    vm.stopPrank();

    uint256 rewardAmount = 100 ether;
    rewardToken3.mint(address(this), rewardAmount);
    rewardToken3.approve(address(rewarder3), rewardAmount);
    // feed reward for 100 seconds
    rewarder3.feed(rewardAmount, block.timestamp + 100);

    // 50 seconds pass
    skip(50);
    vm.prank(ALICE);
    revenueDistributor.withdraw(ALICE, 50 ether);

    // reward = 100, per 100 sec, 1 rewarder per sec
    // pending reward = rewardPerSec * timepass * stakedAmount / totalAmount
    // ALICE pending reward = (1*50)*100/200 = 25
    // BOB pending reward = (1*50)*100/200 25
    assertEq(rewarder3.pendingToken(ALICE), 25 ether);
    assertEq(rewarder3.pendingToken(BOB), 25 ether);

    // another 50 seconds pass
    skip(50);
    // ALICE pending reward = 25 + (1*50*50)/150 = 41.666666666650000000
    // BOB pending reward = 25 + (1*50*100)/150 = 58.333333333300000000
    assertEq(rewarder3.pendingToken(ALICE), 41.66666666665 ether);
    assertEq(rewarder3.pendingToken(BOB), 58.3333333333 ether);

    // perform actual harvest
    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    revenueDistributor.harvest();
    vm.stopPrank();

    assertEq(rewardToken3.balanceOf(ALICE), 41.66666666665 ether);
    assertEq(rewardToken3.balanceOf(BOB), 58.3333333333 ether);
    assertEq(rewarder3.pendingToken(ALICE), 0);
    assertEq(rewarder3.pendingToken(BOB), 0);
  }

  function testCorrectness_MultipleFeed_ThenHarvestLater_ShouldBeEligibleForCorrectReward() public {
    // alice deposit before setting rewarder
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    revenueDistributor.addRewarders(address(rewarder3));

    skip(50);

    // bob deposit after setting rewarder
    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    vm.stopPrank();

    uint256 rewardAmount = 100 ether;
    rewardToken3.mint(address(this), rewardAmount);
    rewardToken3.approve(address(rewarder3), rewardAmount);
    // feed reward for 100 seconds
    rewarder3.feed(rewardAmount, block.timestamp + 100);

    // 50 seconds pass, and bob withdraw
    skip(50);
    vm.prank(BOB);
    revenueDistributor.withdraw(BOB, 50 ether);

    // reward = 100, per 100 sec, 1 rewarder per sec
    // pending reward = rewardPerSec * timepass * stakedAmount / totalAmount
    // ALICE pending reward = (1*50)*100/200 = 25
    // BOB pending reward = (1*50)*100/200 25
    assertEq(rewarder3.pendingToken(ALICE), 25 ether);
    assertEq(rewarder3.pendingToken(BOB), 25 ether);

    // feed with 50 more reward and extend end timestamp for 50 seconds
    rewardToken3.mint(address(this), 50 ether);
    rewardToken3.approve(address(rewarder3), 50 ether);
    // feed reward for 50 seconds
    // rewardPersec is (newReward + undistributedReward)/(endtime - currentTimeStamp) = (50 + 50)/100 = 1 reward per sec
    rewarder3.feed(50 ether, block.timestamp + 100);
    assertEq(rewarder3.rewardPerSecond(), 1 ether);

    // another 100 seconds pass
    skip(100);
    // ALICE pending reward = 25 + (1*100*100)/150 = 91.6666666666
    // BOB pending reward = 25 + (1*100*50)/150 = 58.333333333300000000
    assertEq(rewarder3.pendingToken(ALICE), 91.6666666666 ether);
    assertEq(rewarder3.pendingToken(BOB), 58.3333333333 ether);

    skip(10);
    // BOB deposit another 10, now bob totaStaked = 60
    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 10 ether);
    revenueDistributor.deposit(BOB, 10 ether);
    vm.stopPrank();
    (uint256 _bobStakedAmount, , ) = rewarder3.userInfo(BOB);
    assertEq(_bobStakedAmount, 60 ether);

    // Feed another 200 token for 50 seconds
    rewardToken3.mint(address(this), 200 ether);
    rewardToken3.approve(address(rewarder3), 200 ether);
    // feed reward for 50 seconds
    // rewardPersec is (newReward + undistributedReward)/(endtime - currentTimeStamp) = (0 + 200)/4 = 4 reward per sec
    rewarder3.feed(200 ether, block.timestamp + 50);
    assertEq(rewarder3.rewardPerSecond(), 4 ether);

    // another 25 seconds pass
    skip(25);
    // ALICE pending reward = 91.6666666666 + (4*25*100)/160 = 154.1666666666
    // BOB pending reward = 58.3333333333 + (4*25*60)/160 = 95.8333333333
    assertEq(rewarder3.pendingToken(ALICE), 154.1666666666 ether);
    assertEq(rewarder3.pendingToken(BOB), 95.8333333333 ether);

    // perform actual harvest
    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    revenueDistributor.harvest();
    vm.stopPrank();

    assertEq(rewardToken3.balanceOf(ALICE), 154.1666666666 ether);
    assertEq(rewardToken3.balanceOf(BOB), 95.8333333333 ether);
    assertEq(rewarder3.pendingToken(ALICE), 0);
    assertEq(rewarder3.pendingToken(BOB), 0);

    // another 50 seconds pass with remaining rewardendTime = 25 seconds
    skip(50);
    // ALICE pending reward = 154.1666666666 + (4*25*100)/160 = 62.5
    // BOB pending reward = 95.8333333333 + (4*25*60)/160 = 37.5
    assertEq(rewarder3.pendingToken(ALICE), 62.5 ether);
    assertEq(rewarder3.pendingToken(BOB), 37.5 ether);

    // perform actual harvest
    vm.startPrank(ALICE);
    revenueDistributor.harvest();
    vm.stopPrank();

    vm.startPrank(BOB);
    revenueDistributor.harvest();
    vm.stopPrank();

    assertEq(rewardToken3.balanceOf(ALICE), 216.6666666666 ether);
    assertEq(rewardToken3.balanceOf(BOB), 133.3333333333 ether);
    assertEq(rewarder3.pendingToken(ALICE), 0);
    assertEq(rewarder3.pendingToken(BOB), 0);
  }
}
