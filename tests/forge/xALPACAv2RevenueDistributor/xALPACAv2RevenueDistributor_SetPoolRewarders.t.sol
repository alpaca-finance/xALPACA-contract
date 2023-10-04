// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAv2RevenueDistributor_BaseTest } from "./xALPACAv2RevenueDistributor_BaseTest.t.sol";

// interfaces
import { xALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2RevenueDistributor.sol";
import { IxALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";
import { IxALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/interfaces/IxALPACAv2Rewarder.sol";

contract xALPACAv2RevenueDistributor_SetPoolRewardersTest is xALPACAv2RevenueDistributor_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenSetPoolRewarders() external {
    address[] memory _rewarders = new address[](2);
    _rewarders[0] = address(rewarder1);
    _rewarders[1] = address(rewarder2);
    revenueDistributor.setPoolRewarders(_rewarders);

    assertEq(revenueDistributor.rewarders(0), address(rewarder1));
    assertEq(revenueDistributor.rewarders(1), address(rewarder2));
  }

  function testRevert_WhenSetRewarderWithWrongxALPACAv2RevenueDistributor() external {
    xALPACAv2RevenueDistributor otherxALPACAv2RevenueDistributor = deployxALPACAv2RevenueDistributor(address(alpaca));

    IxALPACAv2Rewarder _newRewarder = deployRewarder(
      "NewRewarder",
      address(otherxALPACAv2RevenueDistributor),
      address(rewardToken1)
    );

    address[] memory _poolRewarders = new address[](2);
    _poolRewarders[0] = address(_newRewarder);
    _poolRewarders[1] = address(rewarder1);
    vm.expectRevert(
      abi.encodeWithSelector(IxALPACAv2RevenueDistributor.xALPACAv2RevenueDistributor_BadRewarder.selector)
    );
    revenueDistributor.setPoolRewarders(_poolRewarders);
  }
}
