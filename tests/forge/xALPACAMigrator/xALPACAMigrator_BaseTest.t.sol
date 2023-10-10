// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { BaseTest, console } from "../base/BaseTest.sol";

// interfaces
import { xALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2RevenueDistributor.sol";
import { xALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2Rewarder.sol";

contract xALPACAMigrator_BaseTest is BaseTest {
  // xALPACAv2Rewarder internal rewarder1;
  // xALPACAv2Rewarder internal rewarder2;

  function setUp() public virtual {
    // vm.createSelectFork(vm.envString("BSC_MAINNET_RPC"), 32474181);
  }

  // function assertStakingReserve(uint256 _expectedAmount) internal {
  //   assertEq(revenueDistributor.stakingReserve(), _expectedAmount);
  // }
}
