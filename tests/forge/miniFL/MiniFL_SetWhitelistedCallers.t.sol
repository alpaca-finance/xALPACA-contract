// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_SetWhitelistedCallersTest is MiniFL_BaseTest {
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
    assertTrue(!miniFL.whitelistedCallers(mockCaller1));
    assertTrue(!miniFL.whitelistedCallers(mockCaller2));

    // set ALICE and BOB as whitelisted callers
    miniFL.setWhitelistedCallers(_callers, true);

    assertTrue(miniFL.whitelistedCallers(mockCaller1));
    assertTrue(miniFL.whitelistedCallers(mockCaller2));
  }

  function testRevert_WhenNonOwnerSetWhitelistedCallers() external {
    // random address which not whitelisted callers
    address randomCaller = makeAddr("randomCaller");
    vm.startPrank(randomCaller);
    vm.expectRevert("Ownable: caller is not the owner");

    miniFL.setWhitelistedCallers(_callers, true);
    vm.stopPrank();
  }
}
