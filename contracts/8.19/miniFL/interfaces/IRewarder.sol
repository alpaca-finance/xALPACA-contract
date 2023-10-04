// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IRewarder {
  error Rewarder_InvalidArguments();
  error Rewarder_NotFL();
  error Rewarder_PoolExisted();
  error Rewarder_PoolNotExisted();
  error Rewarder_Unauthorized();

  function name() external view returns (string memory);

  function miniFL() external view returns (address);

  function onDeposit(address user, uint256 newStakeTokenAmount) external;

  function onWithdraw(address user, uint256 newStakeTokenAmount) external;

  function onHarvest(address user) external;

  function pendingToken(address user) external view returns (uint256);

  function lastRewardTime() external view returns (uint256);

  function feed(uint256 _newRewardPerSecond, uint256 _newRewardEndTimestamp) external;

  function rewardToken() external view returns (address);

  function rewardPerSecond() external view returns (uint256);
}
