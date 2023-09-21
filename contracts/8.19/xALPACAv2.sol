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
  error xALPACAv2_InvalidAmount();

  using SafeToken for address;

  // Token to be locked (ALPACA)
  address public token;

  // Delay period for withdrawal (in seconds)
  uint256 public delayUnlockTime;

  // Total amount of token locked
  uint256 public totalLocked;

  mapping(address => uint256) public userLockAmounts;

  struct UnlockRequest {
    uint256 amount;
    uint64 unlockTimestamp;
    uint8 status; // 0 = unclaimed, 1 = claimed, 2 = canceled
  }

  mapping(address => UnlockRequest[]) public userUnlockRequests;

  constructor() {
    _disableInitializers();
  }

  function initialize(address _token) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    // sanity check
    IBEP20(_token).decimals();

    token = _token;
  }

  /// @dev lock ALPACA to receive voting power
  function lock(uint256 _amount) external {
    // effect
    userLockAmounts[msg.sender] += _amount;
    totalLocked += _amount;
    // interaction
    token.safeTransferFrom(msg.sender, address(this), _amount);
  }

  /// @dev Initiate withdrawal process via delayed unlocking
  function unlock(uint256 _amount) external returns (uint256 _unlockRequestId) {
    // check
    uint256 _userLockedAmount = userLockAmounts[msg.sender];
    if (_userLockedAmount < _amount || _amount == 0) {
      revert xALPACAv2_InvalidAmount();
    }

    // effect
    unchecked {
      userLockAmounts[msg.sender] -= _amount;
      totalLocked -= _amount;
    }

    UnlockRequest memory _request = UnlockRequest({
      amount: _amount,
      unlockTimestamp: uint64(block.timestamp + delayUnlockTime),
      status: 0
    });

    UnlockRequest[] storage _userRequests = userUnlockRequests[msg.sender];

    uint256 _requestId = _userRequests.length;

    _userRequests.push(_request);

    return _requestId;
  }

  /// @dev Claim the unlocked ALPACA
  function withdraw(uint256 _unlockRequestId) external {}

  /// @dev Withdraw without delayed unlocking
  function emergencyWithdraw(uint256 _amount) external {}

  /// @dev Reverse the withdrawal unlocking process
  function cancelUnlock(uint256 _unlockRequestId) external {}

  /// @dev Owner set the delayed unlock time
  function setDelayUnlockTime(uint256 _newDelayUnlockTime) external onlyOwner {
    delayUnlockTime = _newDelayUnlockTime;
  }

  function userUnlockRequestsLastId(address _user) external view returns (uint256) {
    return userUnlockRequests[_user].length;
  }
}
