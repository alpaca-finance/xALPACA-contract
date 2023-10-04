// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { MiniFL } from "../../../contracts/8.19/miniFL/MiniFL.sol";
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";
import { IRewarder } from "../../../contracts/8.19/miniFL/interfaces/IRewarder.sol";

contract MiniFL_SetPoolRewardersTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();
  }

  function testCorrectness_WhenSetPoolRewarders() external {
    address[] memory _rewarders = new address[](2);
    _rewarders[0] = address(rewarder1);
    _rewarders[1] = address(rewarder2);
    miniFL.setPoolRewarders(_rewarders);

    assertEq(miniFL.rewarders(0), address(rewarder1));
    assertEq(miniFL.rewarders(1), address(rewarder2));
  }

  function testRevert_WhenSetRewarderWithWrongMiniFL() external {
    MiniFL otherMiniFL = deployMiniFL(address(alpaca));

    IRewarder _newRewarder = deployRewarder("NewRewarder", address(otherMiniFL), address(rewardToken1));

    address[] memory _poolRewarders = new address[](2);
    _poolRewarders[0] = address(_newRewarder);
    _poolRewarders[1] = address(rewarder1);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_BadRewarder.selector));
    miniFL.setPoolRewarders(_poolRewarders);
  }
}
