// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { xALPACAV2_BaseTest, console } from "../base/xALPACAV2_BaseTest.sol";

// interfaces
import { xALPACAv2RevenueDistributor } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2RevenueDistributor.sol";
import { xALPACAv2Rewarder } from "../../../contracts/8.19/xALPACAv2RevenueDistributor/xALPACAv2Rewarder.sol";

contract xALPACAv2RevenueDistributor_BaseTest is xALPACAV2_BaseTest {
  address[] internal whitelistedCallers = new address[](5);
  address[] internal whitelistedFeeders = new address[](1);

  xALPACAv2Rewarder internal rewarder1;
  xALPACAv2Rewarder internal rewarder2;
  xALPACAv2Rewarder internal rewarder3;

  uint256 maxAlpacaPerSecond = 1000 ether;

  function setUp() public virtual {
    whitelistedCallers[0] = address(this);
    whitelistedCallers[1] = ALICE;
    whitelistedCallers[2] = BOB;
    revenueDistributor.setWhitelistedCallers(whitelistedCallers, true);

    whitelistedFeeders[0] = address(this);
    revenueDistributor.setWhitelistedFeeders(whitelistedFeeders, true);

    alpaca.mint(address(this), 10000000 ether);
    alpaca.approve(address(revenueDistributor), 1000000 ether);
    revenueDistributor.feed(1000 ether * 100, block.timestamp + 100);

    rewarder1 = deployRewarder("REWARDER01", address(revenueDistributor), address(rewardToken1));
    rewarder2 = deployRewarder("REWARDER02", address(revenueDistributor), address(rewardToken2));
    rewarder3 = deployRewarder("REWARDER03", address(revenueDistributor), address(rewardToken3));

    rewardToken1.mint(address(this), 10000000 ether);
    rewardToken2.mint(address(this), 15000000 ether);

    rewardToken1.approve(address(rewarder1), 10000000 ether);
    rewardToken2.approve(address(rewarder2), 15000000 ether);
    rewarder1.feed(100 ether * 100, block.timestamp + 100);
    rewarder2.feed(150 ether * 100, block.timestamp + 100);

    alpaca.mint(ALICE, 100 ether);
    alpaca.mint(EVE, 100 ether);
    alpaca.mint(BOB, 100 ether);
  }

  function setupRewarder() internal {
    revenueDistributor.addRewarders(address(rewarder1));
    revenueDistributor.addRewarders(address(rewarder2));
  }

  function assertRewarderUserInfo(
    xALPACAv2Rewarder _rewarder,
    address _user,
    uint256 _expectedAmount,
    int256 _expectedRewardDebt
  ) internal {
    (uint256 _totalAmount, int256 _rewardDebt) = _rewarder.userInfo(_user);
    assertEq(_totalAmount, _expectedAmount);
    assertEq(_rewardDebt, _expectedRewardDebt);
  }

  function assertStakingReserve(uint256 _expectedAmount) internal {
    assertEq(revenueDistributor.stakingReserve(), _expectedAmount);
  }
}
