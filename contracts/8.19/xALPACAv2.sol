// SPDX-License-Identifier: MIT
/**
 * ∩~~~~∩
 *   ξ ･×･ ξ
 *   ξ　~　ξ
 *   ξ　　 ξ
 *   ξ　　 “~～~～〇
 *   ξ　　　　　　 ξ
 *   ξ ξ ξ~～~ξ ξ ξ
 * 　 ξ_ξξ_ξ　ξ_ξξ_ξ
 * Alpaca Fin Corporation
 *
 */

pragma solidity 0.8.19;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { IBEP20 } from "./interfaces/IBEP20.sol";
import { SafeToken } from "./SafeToken.sol";

/// @title xALPACAv2 - The goverance token (v2) of Alpaca Finance
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase
contract xALPACAv2 is ReentrancyGuardUpgradeable, OwnableUpgradeable {
  using SafeToken for address;

  // Token to be locked (ALPACA)
  address public token;

  // Delay period for withdrawal (in seconds)
  uint256 public delayUnlockTime;

  uint256 public totalLocked;

  mapping(address => uint256) public userLockAmounts;

  constructor() {
    _disableInitializers();
  }

  function initialize(address _token) external initializer {
    // sanity check
    IBEP20(_token).decimals();

    token = _token;
  }

  /// @dev lock ALPACA to receive voting power
  function lock(uint256 _amount) external {
    // check

    // effect
    userLockAmounts[msg.sender] += _amount;
    totalLocked += _amount;
    // interaction
    token.safeTransferFrom(msg.sender, address(this), _amount);
  }

  /// @dev Initiate withdrawal process via delayed unlocking
  function unlock(uint256 _amount) external returns (uint256 _unlockId) {}

  /// @dev Claim the unlocked ALPACA
  function withdraw(uint256 _unlockId) external {}

  /// @dev Withdraw without delayed unlocking
  function emergencyWithdraw(uint256 _amount) external {}

  /// @dev Reverse the withdrawal unlocking process
  function cancelUnlock(uint256 _unlockId) external {}

  /// @dev Owner set the delayed unlock time
  function setUnlockPeriod(uint256 _newUnlockSecond) external onlyOwner {}
}
