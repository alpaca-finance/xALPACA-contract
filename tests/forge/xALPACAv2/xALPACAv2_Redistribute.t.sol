// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { xALPACAV2_BaseTest } from "../base/xALPACAV2_BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_RedistributeTest is xALPACAV2_BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    xAlpacaV2.setDelayUnlockTime(DELAY_UNLOCK_TIME);

    address[] memory _callers = new address[](1);
    _callers[0] = address(this);
    xAlpacaV2.setWhitelistedRedistributors(_callers, true);

    _callers = new address[](2);
    _callers[0] = address(xAlpacaV2);
    _callers[1] = address(this);
    revenueDistributor.setWhitelistedFeeders(_callers, true);
  }

  function testRevert_WhenNotWhitelistedCallRedistribute_ShouldRevert() external {
    vm.startPrank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(xALPACAv2.xALPACAv2_Unauthorized.selector));
    xAlpacaV2.redistribute();
    vm.stopPrank();
  }

  function testCorrectness_WhenRedistribute_ShouldWork() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;
    uint256 _earlyWithdrawFeeBpsPerDay = 50;
    uint256 _redistributionBps = 5000;
    // 50 bps per day
    xAlpacaV2.setEarlyWithdrawFeeBpsPerDay(_earlyWithdrawFeeBpsPerDay);
    xAlpacaV2.setRedistributionBps(_redistributionBps);

    vm.startPrank(ALICE);

    alpaca.approve(address(xAlpacaV2), type(uint256).max);
    xAlpacaV2.lock(ALICE, _lockAmount);

    uint256 _unlockId = xAlpacaV2.unlock(_unlockAmount);

    skip(20.5 days);

    xAlpacaV2.earlyWithdraw(_unlockId);

    vm.stopPrank();

    // entend reward end time
    uint256 rewardEndTime = block.timestamp + 100;
    revenueDistributor.feed(0, rewardEndTime);

    uint256 _toDistributed = xAlpacaV2.accumRedistribute();

    uint256 _revenueDistributorAlpacaBefore = alpaca.balanceOf(address(revenueDistributor));
    uint256 _xAlpacaV2AlpacaBefore = alpaca.balanceOf(address(xAlpacaV2));

    xAlpacaV2.redistribute();

    // _toDistributed > 0
    assertGt(_toDistributed, 0);
    assertEq(xAlpacaV2.accumRedistribute(), 0);
    assertEq(_xAlpacaV2AlpacaBefore - alpaca.balanceOf(address(xAlpacaV2)), _toDistributed);
    assertEq(alpaca.balanceOf(address(revenueDistributor)) - _revenueDistributorAlpacaBefore, _toDistributed);
    // reward end time of revenueDistributor should be the same
    assertEq(revenueDistributor.rewardEndTimestamp(), rewardEndTime);
  }
}
