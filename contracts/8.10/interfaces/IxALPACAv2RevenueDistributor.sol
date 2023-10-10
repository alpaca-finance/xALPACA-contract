// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IxALPACAv2RevenueDistributor {
  function deposit(address _for, uint256 _amountToDeposit) external;

  function withdraw(address _from, uint256 _amountToWithdraw) external;

  function stakingReserve() external view returns (uint256);

  function setWhitelistedCallers(address[] calldata _callers, bool _allow) external;

  function feed(uint256 _rewardAmount, uint256 _newRewardEndTimestamp) external;

  function harvest() external;

  function setPoolRewarders(address[] calldata _newRewarders) external;

  function feeders(address _feeder) external view returns (bool _allow);
}
