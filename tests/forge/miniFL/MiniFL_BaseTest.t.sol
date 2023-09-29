// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { BaseTest, console } from "../base/BaseTest.sol";

// interfaces
import { MiniFL } from "../../../contracts/8.19/miniFL/MiniFL.sol";
import { Rewarder } from "../../../contracts/8.19/miniFL/Rewarder.sol";

contract MiniFL_BaseTest is BaseTest {
  address internal funder1 = makeAddr("funder1");
  address internal funder2 = makeAddr("funder2");

  address[] internal whitelistedCallers = new address[](5);

  Rewarder internal rewarder1;
  Rewarder internal rewarder2;

  uint256 wethPoolID;
  uint256 mockToken1PoolID;
  uint256 notExistsPoolID = 999;

  function setUp() public virtual {
    alpaca.mint(address(this), 10000000000 ether);
    alpaca.approve(address(miniFL), 10000000000 ether);
    miniFL.feed(1000 ether * 100, 100);

    rewarder1 = deployRewarder("REWARDER01", address(miniFL), address(rewardToken1), maxAlpacaPerSecond);
    rewarder2 = deployRewarder("REWARDER02", address(miniFL), address(rewardToken2), maxAlpacaPerSecond);

    rewarder1.setRewardPerSecond(100 ether);
    rewarder2.setRewardPerSecond(150 ether);

    rewardToken1.mint(address(rewarder1), 10000 ether);
    rewardToken2.mint(address(rewarder2), 15000 ether);

    weth.mint(funder1, 100 ether);
    weth.mint(funder2, 100 ether);

    vm.prank(funder1);
    weth.approve(address(miniFL), 100 ether);
    vm.prank(funder2);
    weth.approve(address(miniFL), 100 ether);

    whitelistedCallers[0] = address(this);
    whitelistedCallers[1] = ALICE;
    whitelistedCallers[2] = BOB;
    whitelistedCallers[3] = funder1;
    whitelistedCallers[4] = funder2;
    miniFL.setWhitelistedCallers(whitelistedCallers, true);
  }

  // Rewarder1 Info
  // | Pool   | AllocPoint |
  // | WETH   |         90 |
  // | DToken |         10 |
  // Rewarder2 Info
  // | Pool   | AllocPoint |
  // | DToken |        100 |
  function setupRewarder() internal {
    address[] memory rewarders = new address[](2);
    rewarders[0] = address(rewarder1);
    rewarders[1] = address(rewarder2);
    miniFL.setPoolRewarders(rewarders);
  }

  function prepareForHarvest() internal {
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    console.log("WETH POOOL", wethPoolID);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    weth.approve(address(miniFL), 6 ether);
    miniFL.deposit(BOB, 6 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 90 ether);
    miniFL.deposit(BOB, 90 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, 10 ether);
    vm.stopPrank();

    vm.prank(funder1);
    miniFL.deposit(ALICE, 4 ether);

    vm.prank(funder2);
    miniFL.deposit(ALICE, 6 ether);

    vm.prank(funder1);
    miniFL.deposit(BOB, 4 ether);
  }

  function assertTotalUserStakingAmountWithReward(
    address _user,
    uint256 _expectedAmount,
    int256 _expectedRewardDebt
  ) internal {
    (uint256 _totalAmount, int256 _rewardDebt) = miniFL.userInfo(_user);
    assertEq(_totalAmount, _expectedAmount);
    assertEq(_rewardDebt, _expectedRewardDebt);
  }

  function assertTotalUserStakingAmount(address _user, uint256 _expectedAmount) internal {
    (uint256 _totalAmount, ) = miniFL.userInfo(_user);
    assertEq(_totalAmount, _expectedAmount);
  }

  function assertFunderAmount(
    address _funder,
    address _for,
    uint256 _expectedAmount
  ) internal {
    uint256 _amount = miniFL.getUserAmountFundedBy(_funder, _for);
    assertEq(_amount, _expectedAmount);
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
