// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IRewarder {
  error Rewarder1_BadArguments();
  error Rewarder1_NotFL();
  error Rewarder1_PoolExisted();
  error Rewarder1_PoolNotExisted();

  function name() external view returns (string memory);

  function miniFL() external view returns (address);

  function onDeposit(
    uint256 pid,
    address user,
    uint256 newStakeTokenAmount
  ) external;

  function onWithdraw(
    uint256 pid,
    address user,
    uint256 newStakeTokenAmount
  ) external;

  function onHarvest(uint256 pid, address user) external;

  function pendingToken(uint256 pid, address user) external view returns (uint256);

  function lastRewardTime(uint256 _pid) external view returns (uint256);

  function addPool(
    uint256 _pid,
    uint256 _allocPoint,
    bool _withUpdate
  ) external;

  function setPool(
    uint256 _pid,
    uint256 _newAllocPoint,
    bool _withUpdate
  ) external;

  function setRewardPerSecond(uint256 _newRewardPerSecond, bool _withUpdate) external;

  function rewardToken() external view returns (address);

  function rewardPerSecond() external view returns (uint256);

  function totalAllocPoint() external view returns (uint256);

  function getPoolAllocPoint(uint256 _pid) external view returns (uint256 _allocPoint);
}
