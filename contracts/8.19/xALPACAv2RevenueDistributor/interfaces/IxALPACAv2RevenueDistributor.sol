// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IxALPACAv2RevenueDistributor {
  error xALPACAv2RevenueDistributor_DuplicatePool();
  error xALPACAv2RevenueDistributor_InvalidArguments();
  error xALPACAv2RevenueDistributor_BadRewarder();
  error xALPACAv2RevenueDistributor_Unauthorized();
  error xALPACAv2RevenueDistributor_InsufficientAmount();

  function deposit(address _for, uint256 _amountToDeposit) external;

  function withdraw(address _from, uint256 _amountToWithdraw) external;

  function stakingReserve() external view returns (uint256);

  function setWhitelistedCallers(address[] calldata _callers, bool _allow) external;

  function feed(uint256 _rewardAmount, uint256 _newRewardEndTimestamp) external;

  function harvest() external;

  function addRewarders(address _rewarder) external;

  function feeders(address _feeder) external view returns (bool _allow);

  function rewardEndTimestamp() external view returns (uint256);

  function getUserTotalAmountOf(address _user) external view returns (uint256);
}
