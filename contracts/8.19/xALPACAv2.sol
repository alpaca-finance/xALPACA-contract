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

  //--------- Errors ------------//
  error xALPACAv2_InvalidAmount();
  error xALPACAv2_InvalidStatus();
  error xALPACAv2_UnlockTimeUnreached();
  error xALPACAv2_UnlockTimeReached();
  error xALPACAv2_InvalidBreakerValue();
  error xALPACAv2_InvalidAddress();

  //--------- Events ------------//
  event LogSetBreaker(uint256 _previousBreaker, uint256 _breaker);
  event LogSetDelayUnlockTime(uint256 _previousDelay, uint256 _newDelay);
  event LogLock(address indexed _user, uint256 _amount);
  event LogUnlock(address indexed _user, uint256 _unlockRequestId);
  event LogCancelUnlock(address indexed _user, uint256 _unlockRequestId);
  event LogWithdraw(address indexed _user, uint256 _amount, uint256 _withdrawalFee);
  event LogSetEarlyWithdrawFeeBpsPerDay(uint256 _previousFee, uint256 _newFee);
  event LogWithdrawReserve(address indexed _to, uint256 _amount);

  //--------- States ------------//
  // Token to be locked (ALPACA)
  address public token;

  // Delay period for withdrawal (in seconds)
  uint256 public delayUnlockTime;

  // Total amount of token locked
  uint256 public totalLocked;

  // Flag to allow emergency withdraw
  uint256 public breaker;

  // Protocol Early Withdrawal Fee
  uint256 public feeReserve;

  // penalty per sec
  uint256 public earlyWithdrawFeeBpsPerDay;

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

  /// @notice Lock token to receive voting power
  /// @param _amount The amount of token to be locked
  function lock(uint256 _amount) external {
    // effect
    userLockAmounts[msg.sender] += _amount;
    totalLocked += _amount;
    // interaction
    token.safeTransferFrom(msg.sender, address(this), _amount);
    // todo: deposit to miniFL on behalf of user

    emit LogLock(msg.sender, _amount);
  }

  /// @notice Initiate withdrawal process via delayed unlocking
  /// @param _amount The amount to unlock
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

    if (breaker == 0) {
      UnlockRequest[] storage _userRequests = userUnlockRequests[msg.sender];

      _unlockRequestId = _userRequests.length;

      _userRequests.push(_request);
      // interaction
      // todo: withdraw from miniFL

      emit LogUnlock(msg.sender, _unlockRequestId);
    } else {
      // todo: withdraw from miniFL
      token.safeTransfer(msg.sender, _amount);
    }
  }

  /// @notice Claim the unlocked ALPACA
  /// @param _unlockRequestId The id of request to withdraw from
  function withdraw(uint256 _unlockRequestId) external {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != 0) {
      revert xALPACAv2_InvalidStatus();
    }

    // revert if it's not unlock time yet
    if (request.unlockTimestamp > block.timestamp) {
      revert xALPACAv2_UnlockTimeUnreached();
    }

    // effect
    request.status = 1; // withdrawn

    // interaction
    token.safeTransfer(msg.sender, request.amount);

    emit LogWithdraw(msg.sender, request.amount, 0);
  }

  /// @notice Premature withdrawal before unlock completed
  /// @param _unlockRequestId The id of request to withdraw from
  function earlyWithdraw(uint256 _unlockRequestId) external {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != 0) {
      revert xALPACAv2_InvalidStatus();
    }

    if (block.timestamp >= request.unlockTimestamp) {
      revert xALPACAv2_UnlockTimeReached();
    }
    // effect
    // fee = (amount * fee per day * second until unlock) / second in day
    uint256 _earlyWithdrawalFee = (
      (request.amount * earlyWithdrawFeeBpsPerDay * (request.unlockTimestamp - block.timestamp))
    ) / (10000 * 1 days);
    uint256 _amountToUser = request.amount - _earlyWithdrawalFee;

    request.status = 1; // withdrawn
    feeReserve += _earlyWithdrawalFee;

    // interaction
    token.safeTransfer(msg.sender, _amountToUser);
    emit LogWithdraw(msg.sender, _amountToUser, feeReserve);
  }

  /// @notice Reverse the withdrawal unlocking process
  /// @param _unlockRequestId The id of request to cancel
  function cancelUnlock(uint256 _unlockRequestId) external {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != 0) {
      revert xALPACAv2_InvalidStatus();
    }

    // effect
    totalLocked += request.amount;
    userLockAmounts[msg.sender] += request.amount;
    request.status = 2; // canceled

    // interaction
    // todo: deposit back to miniFL

    emit LogUnlock(msg.sender, _unlockRequestId);
  }

  // -------- Privilege Functions -----//

  /// @notice Owner set the delayed unlock time
  /// @param _newDelayUnlockTime Time delay in seconds needed for withdrawal
  function setDelayUnlockTime(uint256 _newDelayUnlockTime) external onlyOwner {
    emit LogSetDelayUnlockTime(delayUnlockTime, _newDelayUnlockTime);
    delayUnlockTime = _newDelayUnlockTime;
  }

  /// @notice Owner withdraw early withdrawal fee
  /// @param _to Destination address
  /// @param _amount Amount to withdraw
  function withdrawReserve(address _to, uint256 _amount) external onlyOwner {
    // check
    if (_to == address(0) || _to == address(this)) {
      revert xALPACAv2_InvalidAddress();
    }

    if (feeReserve < _amount) {
      revert xALPACAv2_InvalidAmount();
    }

    // effect
    unchecked {
      feeReserve -= _amount;
    }

    // interaction
    token.safeTransfer(_to, _amount);

    emit LogWithdrawReserve(_to, _amount);
  }

  /// @notice Owner set early withdraw fee bps per sec
  /// @param _newFeePerPerDay The new early withdrawal bps per day
  function setEarlyWithdrawFeeBpsPerDay(uint256 _newFeePerPerDay) external onlyOwner {
    emit LogSetEarlyWithdrawFeeBpsPerDay(earlyWithdrawFeeBpsPerDay, _newFeePerPerDay);
    earlyWithdrawFeeBpsPerDay = _newFeePerPerDay;
  }

  /// @dev Owner enable emergency withdraw
  /// @param _breaker The new value of breaker 0 if off, 1 if on
  function setBreaker(uint256 _breaker) external onlyOwner {
    if (_breaker > 1) {
      revert xALPACAv2_InvalidBreakerValue();
    }
    uint256 _previousBreaker = breaker;
    breaker = _breaker;
    emit LogSetBreaker(_previousBreaker, breaker);
  }

  // -------- View Functions --------//

  function userUnlockRequestsLastId(address _user) external view returns (uint256) {
    return userUnlockRequests[_user].length;
  }
}
