// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest, console } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_HarvestTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_MutipleStakers_ShouldAllocateCorrectly() external {
    vm.startPrank(ALICE);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(ALICE, 100 ether);
    vm.stopPrank();

    skip(50);

    vm.startPrank(ALICE);
    uint256 _aliceAlpacaBefore = alpaca.balanceOf(ALICE);
    revenueDistributor.harvest();

    // 1000 per sec
    // 1000 * 50
    assertEq(alpaca.balanceOf(ALICE) - _aliceAlpacaBefore, 50000 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    alpaca.approve(address(revenueDistributor), 100 ether);
    revenueDistributor.deposit(BOB, 100 ether);
    skip(50);

    uint256 _bobAlpacaBefore = alpaca.balanceOf(BOB);

    revenueDistributor.harvest();

    assertEq(alpaca.balanceOf(BOB) - _bobAlpacaBefore, 25000 ether);
    vm.stopPrank();
  }

  function testCorrectness_MutipleStakers_FeedAfterRewardEnded_ShouldAllocateCorrectly() external {
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
    revenueDistributor.feed(500 ether, block.timestamp + 50);

    skip(50);

    vm.startPrank(ALICE);
    uint256 _alpacaAliceBefore = alpaca.balanceOf(ALICE);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 + (50 * 10)/2 = 25000 + 250 = 25050
    assertEq(alpaca.balanceOf(ALICE) - _alpacaAliceBefore, 25250 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    uint256 _alpacaBobBefore = alpaca.balanceOf(BOB);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 + (50 * 10)/2 = 25000 + 250 = 25050
    assertEq(alpaca.balanceOf(BOB) - _alpacaBobBefore, 25250 ether);
    vm.stopPrank();
  }

  function testCorrectness_MutipleStakers_FeedBeforeRewardEnded_ShouldAllocateCorrectly() external {
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
    revenueDistributor.feed(500 ether, block.timestamp + 50);

    skip(50);

    vm.startPrank(ALICE);
    uint256 _alpacaAliceBefore = alpaca.balanceOf(ALICE);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 +(30 * 10)/2 = 25000 + 250 = 25050
    assertEq(alpaca.balanceOf(ALICE) - _alpacaAliceBefore, 25250 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    uint256 _alpacaBobBefore = alpaca.balanceOf(BOB);
    revenueDistributor.harvest();
    // (50 * 1000 ether)/2 + (50 * 10)/2 = 25000 + 250 = 25050
    assertEq(alpaca.balanceOf(BOB) - _alpacaBobBefore, 25250 ether);
    vm.stopPrank();
  }
}
