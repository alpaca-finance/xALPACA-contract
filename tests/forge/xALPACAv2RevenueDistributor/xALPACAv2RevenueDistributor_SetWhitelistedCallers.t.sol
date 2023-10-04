// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

contract xALPACAv2RevenueDistributor_SetWhitelistedCallersTest is xALPACAv2RevenueDistributor_BaseTest {
  address[] _callers;
  address mockCaller1 = makeAddr("mockCaller1");
  address mockCaller2 = makeAddr("mockCaller2");

  function setUp() public override {
    super.setUp();

    _callers = new address[](2);
    _callers[0] = mockCaller1;
    _callers[1] = mockCaller2;
  }

  function testCorrectness_WhenSetWhitelistedCallers() external {
    // ALICE and BOB are non-whitelisted callers yet.
    assertTrue(!revenueDistributor.whitelistedCallers(mockCaller1));
    assertTrue(!revenueDistributor.whitelistedCallers(mockCaller2));

    // set ALICE and BOB as whitelisted callers
    revenueDistributor.setWhitelistedCallers(_callers, true);

    assertTrue(revenueDistributor.whitelistedCallers(mockCaller1));
    assertTrue(revenueDistributor.whitelistedCallers(mockCaller2));
  }

  function testRevert_WhenNonOwnerSetWhitelistedCallers() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    vm.expectRevert("Ownable: caller is not the owner");

    revenueDistributor.setWhitelistedCallers(_callers, true);
    vm.stopPrank();
  }
}
