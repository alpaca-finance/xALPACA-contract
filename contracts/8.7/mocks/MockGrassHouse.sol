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
**/

pragma solidity 0.8.7;

import "../interfaces/IGrassHouse.sol";

import "../SafeToken.sol";

/// @title MockGrassHouse - Where Alpaca eats
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase
contract MockGrassHouse is IGrassHouse {
  using SafeToken for address;
  address public rewardToken;

  /// @notice Constructor to instaniate MockGrassHouse
  /// @param _rewardToken The token to be distributed
  constructor(address _rewardToken) {
    rewardToken = _rewardToken;
  }

  /// @notice Receive rewardTokens into the contract and trigger token checkpoint
  function feed(uint256 _amount) external override returns (bool) {
    rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
    return true;
  }
}
