// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { BaseTest } from "./base/BaseTest.sol";

contract MockTest is BaseTest {
  function test_ShouldWork() external {
    assertEq(uint256(1), uint256(1));
  }
}
