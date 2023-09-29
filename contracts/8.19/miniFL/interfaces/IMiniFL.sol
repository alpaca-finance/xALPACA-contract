// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IRewarder.sol";

interface IMiniFL {
  error MiniFL_DuplicatePool();
  error MiniFL_InvalidArguments();
  error MiniFL_BadRewarder();
  error MiniFL_InsufficientFundedAmount();
  error MiniFL_Unauthorized();

  function deposit(
    address _for,
    uint256 _pid,
    uint256 _amountToDeposit
  ) external;

  function withdraw(
    address _from,
    uint256 _pid,
    uint256 _amountToWithdraw
  ) external;

  function poolLength() external view returns (uint256);

  function stakingTokens(uint256 _pid) external view returns (address);

  function getStakingReserves(uint256 _pid) external view returns (uint256);

  function setWhitelistedCallers(address[] calldata _callers, bool _allow) external;

  function setPool(
    uint256 _pid,
    uint256 _newAllocPoint,
    bool _withUpdate
  ) external;

  function feed(uint256 _rewardAmount, uint256 _rewardEndTimestamp) external;

  function harvest(uint256 _pid) external;

  function harvestMany(uint256[] calldata _pids) external;

  function massUpdatePools() external;

  function setPoolRewarders(uint256 _pid, address[] calldata _newRewarders) external;
}
