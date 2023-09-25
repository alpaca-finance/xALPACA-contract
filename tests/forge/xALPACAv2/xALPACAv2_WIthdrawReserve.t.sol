// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "../base/BaseTest.sol";

import "../utils/Components.sol";

import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

contract xALPACAv2_WithdrawReserveTest is BaseTest {
  uint256 public constant DELAY_UNLOCK_TIME = 21 days;

  function setUp() public {
    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(BOB, 100 ether);
    console.log(xALPACA.owner());
    xALPACA.setDelayUnlockTime(DELAY_UNLOCK_TIME);
  }

  function testCorrectness_WhenOwnerWithdrawReserve_ShouldWork() external {
    uint256 _lockAmount = 10 ether;
    uint256 _unlockAmount = 4 ether;
    // 50 bps per day
    xALPACA.setEarlyWithdrawFeeBpsPerDay(50);

    vm.startPrank(ALICE);
    alpaca.approve(address(xALPACA), type(uint256).max);
    xALPACA.lock(_lockAmount);

    uint256 _unlockId = xALPACA.unlock(_unlockAmount);

    xALPACA.earlyWithdraw(_unlockId);
    vm.stopPrank();

    uint256 _feeReserve = xALPACA.feeReserve();

    xALPACA.withdrawReserve(address(this), _feeReserve);

    assertEq(alpaca.balanceOf(address(this)), _feeReserve);
  }
}
