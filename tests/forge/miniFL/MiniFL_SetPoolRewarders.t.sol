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
    setupMiniFLPool();
  }

  function testCorrectness_WhenSetPoolRewarders() external {
    rewarder1.addPool(wethPoolID, 90, false);
    rewarder1.addPool(mockToken1PoolID, 10, false);

    rewarder2.addPool(wethPoolID, 100, false);

    address[] memory _poolWethRewarders = new address[](2);
    _poolWethRewarders[0] = address(rewarder1);
    _poolWethRewarders[1] = address(rewarder2);
    miniFL.setPoolRewarders(wethPoolID, _poolWethRewarders);

    address[] memory _poolDebtTokenRewarders = new address[](1);
    _poolDebtTokenRewarders[0] = address(rewarder1);
    miniFL.setPoolRewarders(mockToken1PoolID, _poolDebtTokenRewarders);

    assertEq(miniFL.rewarders(wethPoolID, 0), address(rewarder1));
    assertEq(miniFL.rewarders(wethPoolID, 1), address(rewarder2));
    assertEq(miniFL.rewarders(mockToken1PoolID, 0), address(rewarder1));
  }

  function testRevert_WhenSetRewarderWithWrongMiniFL() external {
    MiniFL otherMiniFL = deployMiniFL(address(alpaca));

    IRewarder _newRewarder = deployRewarder(
      "NewRewarder",
      address(otherMiniFL),
      address(rewardToken1),
      maxAlpacaPerSecond
    );

    address[] memory _poolDebtTokenRewarders = new address[](2);
    _poolDebtTokenRewarders[0] = address(_newRewarder);
    _poolDebtTokenRewarders[1] = address(rewarder1);
    vm.expectRevert(abi.encodeWithSelector(IMiniFL.MiniFL_BadRewarder.selector));
    miniFL.setPoolRewarders(mockToken1PoolID, _poolDebtTokenRewarders);
  }

  function testRevert_TryingToSetPoolThatHasNotBeenAdded_ShouldRevert() external {
    vm.expectRevert(abi.encodeWithSelector(IRewarder.Rewarder1_PoolNotExisted.selector));
    rewarder1.setPool(9999, 1000, false);
  }
}
