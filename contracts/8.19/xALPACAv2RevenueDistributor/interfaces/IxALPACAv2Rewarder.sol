// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IxALPACAv2Rewarder {
  error xALPACAv2Rewarder_InvalidArguments();
  error xALPACAv2Rewarder_NotxALPACAv2RevenueDistributor();
  error xALPACAv2Rewarder_PoolExisted();
  error xALPACAv2Rewarder_PoolNotExisted();
  error xALPACAv2Rewarder_Unauthorized();

  function name() external view returns (string memory);

  function xALPACAv2RevenueDistributor() external view returns (address);

  function onDeposit(address user, uint256 newStakeTokenAmount, uint256 _previousStakingReserve) external;

  function onWithdraw(
    address user,
    uint256 newStakeTokenAmount,
    uint256 oldStakeTokenAmount,
    uint256 _previousStakingReserve
  ) external;

  function onHarvest(address user, uint256 _userAmount, uint256 _stakingReserve) external;

  function pendingToken(address user) external view returns (uint256);

  function lastRewardTime() external view returns (uint256);

  function feed(uint256 _newRewardPerSecond, uint256 _newRewardEndTimestamp) external;

  function rewardToken() external view returns (address);

  function rewardPerSecond() external view returns (uint256);
}
