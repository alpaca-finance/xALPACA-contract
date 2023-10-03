// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { BaseTest, console } from "../base/BaseTest.sol";

// interfaces
import { MiniFL } from "../../../contracts/8.19/miniFL/MiniFL.sol";
import { Rewarder } from "../../../contracts/8.19/miniFL/Rewarder.sol";

contract MiniFL_BaseTest is BaseTest {
  address[] internal whitelistedCallers = new address[](5);
  address[] internal whitelistedFeeders = new address[](1);

  Rewarder internal rewarder1;
  Rewarder internal rewarder2;

  function setUp() public virtual {
    whitelistedCallers[0] = address(this);
    whitelistedCallers[1] = ALICE;
    whitelistedCallers[2] = BOB;
    miniFL.setWhitelistedCallers(whitelistedCallers, true);

    whitelistedFeeders[0] = address(this);
    miniFL.setWhitelistedFeeders(whitelistedFeeders, true);

    alpaca.mint(address(this), 10000000 ether);
    alpaca.approve(address(miniFL), 1000000 ether);
    miniFL.feed(1000 ether * 100, block.timestamp + 100);

    rewarder1 = deployRewarder("REWARDER01", address(miniFL), address(rewardToken1));
    rewarder2 = deployRewarder("REWARDER02", address(miniFL), address(rewardToken2));

    rewardToken1.mint(address(this), 10000 ether);
    rewardToken2.mint(address(this), 15000 ether);

    rewardToken1.approve(address(rewarder1), 10000 ether);
    rewardToken2.approve(address(rewarder2), 15000 ether);
    rewarder1.feed(100 ether * 100, block.timestamp + 100);
    rewarder2.feed(150 ether * 100, block.timestamp + 100);

    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(EVE, 100 ether);
    alpaca.mint(BOB, 100 ether);
  }

  function setupRewarder() internal {
    address[] memory rewarders = new address[](2);
    rewarders[0] = address(rewarder1);
    rewarders[1] = address(rewarder2);
    miniFL.setPoolRewarders(rewarders);
  }

  function assertRewarderUserInfo(
    Rewarder _rewarder,
    address _user,
    uint256 _expectedAmount,
    int256 _expectedRewardDebt
  ) internal {
    (uint256 _totalAmount, int256 _rewardDebt) = _rewarder.userInfo(_user);
    assertEq(_totalAmount, _expectedAmount);
    assertEq(_rewardDebt, _expectedRewardDebt);
  }

  function assertStakingReserve(uint256 _expectedAmount) internal {
    assertEq(miniFL.stakingReserve(), _expectedAmount);
  }
}
