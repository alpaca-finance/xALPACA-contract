// SPDX-License-Identifier: MIT
/**
  ∩~~~~∩ 
  ξ ･×･ ξ 
  ξ　~　ξ 
  ξ　　 ξ 
  ξ　　 “~～~～〇 
  ξ　　　　　　 ξ 
  ξ ξ ξ~～~ξ ξ ξ 
　 ξ_ξξ_ξ　ξ_ξξ_ξ
Alpaca Fin Corporation
*/

pragma solidity 0.8.10;

  struct Point {
    int128 bias; // Voting weight
    int128 slope; // Multiplier factor to get voting weight at a given time
    uint256 timestamp;
    uint256 blockNumber;
  }

  struct LockedBalance {
    int128 amount;
    uint256 end;
  }

interface IxALPACA {
  /// @dev Return the max epoch of the given "_user"
  function userPointEpoch(address _user) external view returns (uint256);

  /// @dev Return the max global epoch
  function epoch() external view returns (uint256);

  /// @dev Return the recorded point for _user at specific _epoch
  function userPointHistory(address _user, uint256 _epoch) external view returns (Point memory);

  /// @dev Return the recorded global point at specific _epoch
  function pointHistory(uint256 _epoch) external view returns (Point memory);

  /// @dev Trigger global check point
  function checkpoint() external;

  /// @dev Create new lock
  function createLock(uint256 _amount, uint256 _unlockTime) external;

  /// @dev Mapping (user => LockedBalance) to keep locking information for each user
  function locks(address user) external view returns (LockedBalance memory);

  /// @notice Increase lock amount without increase "end"
  /// @param _amount The amount of ALPACA to be added to the lock
  function increaseLockAmount(uint256 _amount) external;

  /// @notice Withdraw all ALPACA when lock has expired.
  function withdraw() external;
}
