// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IRewarder.sol";

interface IMiniFL {
  error MiniFL_DuplicatePool();
  error MiniFL_InvalidArguments();
  error MiniFL_BadRewarder();
  error MiniFL_Unauthorized();
  error MiniFL_InsufficientAmount();

  function deposit(address _for, uint256 _amountToDeposit) external;

  function withdraw(address _from, uint256 _amountToWithdraw) external;

  function stakingReserve() external view returns (uint256);

  function setWhitelistedCallers(address[] calldata _callers, bool _allow) external;

  function feed(uint256 _rewardAmount, uint256 _newRewardEndTimestamp) external;

  function harvest() external;

  function setPoolRewarders(address[] calldata _newRewarders) external;
}
