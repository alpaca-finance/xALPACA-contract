// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { xALPACAMigrator_BaseTest } from "./xALPACAMigrator_BaseTest.t.sol";

contract xALPACAMigrator_MigrateToV2Test is xALPACAMigrator_BaseTest {
  function setUp() public virtual {
    vm.prank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xALPACAv2));
  }

  function testCorrectness_WhenMigrateToV2_ShouldWork() external {
    address[] _users = new address[](2);
    xalpacaMigrator.migrateToV2(_users);
  }
}
