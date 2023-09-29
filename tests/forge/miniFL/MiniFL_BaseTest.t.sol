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
    miniFL.setAlpacaPerSecond(maxAlpacaPerSecond, type(uint256).max, false);

    alpaca.mint(address(miniFL), 10000000 ether);

    rewarder1 = deployRewarder("REWARDER01", address(miniFL), address(rewardToken1), maxAlpacaPerSecond);
    rewarder2 = deployRewarder("REWARDER02", address(miniFL), address(rewardToken2), maxAlpacaPerSecond);

    rewarder1.setRewardPerSecond(100 ether, false);
    rewarder2.setRewardPerSecond(150 ether, false);

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

  function setupMiniFLPool() internal {
    // add staking pool
    wethPoolID = miniFL.addPool(60, address(weth), false);
    // add debt token pool
    mockToken1PoolID = miniFL.addPool(40, address(mockToken1), false);

    // set debtToken staker
    uint256[] memory _poolIds = new uint256[](1);
    _poolIds[0] = mockToken1PoolID;
    address[] memory _stakers = new address[](1);
    _stakers[0] = BOB;
    mockToken1.mint(BOB, 1000 ether);
  }

  // Rewarder1 Info
  // | Pool   | AllocPoint |
  // | WETH   |         90 |
  // | DToken |         10 |
  // Rewarder2 Info
  // | Pool   | AllocPoint |
  // | DToken |        100 |
  function setupRewarder() internal {
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
  }

  function prepareForHarvest() internal {
    vm.startPrank(ALICE);
    weth.approve(address(miniFL), 10 ether);
    console.log("WETH POOOL", wethPoolID);
    miniFL.deposit(ALICE, wethPoolID, 10 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    weth.approve(address(miniFL), 6 ether);
    miniFL.deposit(BOB, wethPoolID, 6 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 90 ether);
    miniFL.deposit(BOB, mockToken1PoolID, 90 ether);
    vm.stopPrank();

    vm.startPrank(BOB);
    mockToken1.approve(address(miniFL), 10 ether);
    miniFL.deposit(ALICE, mockToken1PoolID, 10 ether);
    vm.stopPrank();

    vm.prank(funder1);
    miniFL.deposit(ALICE, wethPoolID, 4 ether);

    vm.prank(funder2);
    miniFL.deposit(ALICE, wethPoolID, 6 ether);

    vm.prank(funder1);
    miniFL.deposit(BOB, wethPoolID, 4 ether);
  }

  function assertTotalUserStakingAmountWithReward(
    address _user,
    uint256 _pid,
    uint256 _expectedAmount,
    int256 _expectedRewardDebt
  ) internal {
    (uint256 _totalAmount, int256 _rewardDebt) = miniFL.userInfo(_pid, _user);
    assertEq(_totalAmount, _expectedAmount);
    assertEq(_rewardDebt, _expectedRewardDebt);
  }

  function assertTotalUserStakingAmount(
    address _user,
    uint256 _pid,
    uint256 _expectedAmount
  ) internal {
    (uint256 _totalAmount, ) = miniFL.userInfo(_pid, _user);
    assertEq(_totalAmount, _expectedAmount);
  }

  function assertFunderAmount(
    address _funder,
    address _for,
    uint256 _pid,
    uint256 _expectedAmount
  ) internal {
    uint256 _amount = miniFL.getUserAmountFundedBy(_funder, _for, _pid);
    assertEq(_amount, _expectedAmount);
  }

  function assertRewarderUserInfo(
    Rewarder _rewarder,
    address _user,
    uint256 _pid,
    uint256 _expectedAmount,
    int256 _expectedRewardDebt
  ) internal {
    (uint256 _totalAmount, int256 _rewardDebt) = _rewarder.userInfo(_pid, _user);
    assertEq(_totalAmount, _expectedAmount);
    assertEq(_rewardDebt, _expectedRewardDebt);
  }

  function assertStakingReserve(uint256 _pid, uint256 _expectedAmount) internal {
    assertEq(miniFL.getStakingReserves(_pid), _expectedAmount);
  }
}
