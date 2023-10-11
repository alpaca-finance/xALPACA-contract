// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { xALPACAMigrator_BaseTest, IERC20Upgradeable } from "./xALPACAMigrator_BaseTest.t.sol";

contract xALPACAMigrator_SetxALPACAv2Test is xALPACAMigrator_BaseTest {
  function testRevert_WhenNotOwnerCallSetxALPACAv2_ShoudlRevert() external {
    address[] memory _users = new address[](2);
    _users[0] = ALICE;
    _users[1] = BOB;
    vm.expectRevert("Ownable: caller is not the owner");
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));
  }

  function testRevert_WhenOwnerCallSetxALPACAv2_ShoudlWork() external {
    vm.prank(deployer);
    xalpacaMigrator.setxALPACAv2(address(xAlpacaV2));

    assertEq(xalpacaMigrator.xALPACAv2(), address(xAlpacaV2));
  }
}
