// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IRewarder {
  error Rewarder1_BadArguments();
  error Rewarder1_NotFL();
  error Rewarder1_PoolExisted();
  error Rewarder1_PoolNotExisted();

  function name() external view returns (string memory);

  function miniFL() external view returns (address);

  function onDeposit(address user, uint256 newStakeTokenAmount) external;

  function onWithdraw(address user, uint256 newStakeTokenAmount) external;

  function onHarvest(address user) external;

  function pendingToken(address user) external view returns (uint256);

  function lastRewardTime() external view returns (uint256);

  function setRewardPerSecond(uint256 _newRewardPerSecond) external;

  function rewardToken() external view returns (address);

  function rewardPerSecond() external view returns (uint256);
}
