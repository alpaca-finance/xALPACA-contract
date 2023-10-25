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

import { IxALPACAv2RevenueDistributor } from "./xALPACAv2RevenueDistributor/interfaces/IxALPACAv2RevenueDistributor.sol";

/// @title xALPACAv2 - The governance locking contract of Alpaca Finance (v2)
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
  error xALPACAv2_TooMuchDelay();
  error xALPACAv2_TooMuchFee();
  error xALPACAv2_Unauthorized();
  error xALPACAv2_InvalidParams();

  //--------- Events ------------//
  event LogLock(address indexed _user, uint256 _amount);
  event LogUnlock(address indexed _user, uint256 _unlockRequestId);
  event LogCancelUnlock(address indexed _user, uint256 _unlockRequestId);
  event LogWithdraw(address indexed _user, uint256 _amount);
  event LogEarlyWithdraw(address indexed _user, uint256 _feeToTreasury, uint256 _toRedistribute);
  event LogTransfer(address indexed _from, address indexed _to, uint256 _amount);
  event LogSetBreaker(uint256 _previousBreaker, uint256 _breaker);
  event LogSetDelayUnlockTime(uint256 _previousDelay, uint256 _newDelay);
  event LogSetFeeTreasury(address _previousFeeTreasury, address _newFeeTreasury);
  event LogSetEarlyWithdrawFeeBpsPerDay(uint256 _previousFee, uint256 _newFee);
  event LogRedistribute(address indexed _from, address indexed _to, uint256 _amount);
  event LogSetWhitelistedRedistributors(address indexed _caller, address indexed _addr, bool _ok);
  event LogSetRedistributionBps(address indexed _caller, uint256 _newRedistributionFee);

  //--------- Enum --------------//
  enum UnlockStatus {
    INITIATED,
    CLAIMED,
    CANCELED
  }

  //--------- Struct ------------//
  struct UnlockRequest {
    uint256 amount;
    uint64 unlockTimestamp;
    UnlockStatus status; // 0 = unclaimed, 1 = claimed, 2 = canceled
  }

  //--------- States ------------//
  // Token to be locked (ALPACA)
  address public token;

  // Delay period for withdrawal (in seconds)
  uint256 public delayUnlockTime;

  // Total amount of token locked
  uint256 public totalLocked;

  // Flag to allow emergency withdraw
  uint256 public breaker;

  // Protocol Early Withdrawal Fee treasury
  address public feeTreasury;

  // Revenue Distributor
  address public revenueDistributor;

  // penalty per day
  uint256 public earlyWithdrawFeeBpsPerDay;

  // Propotion from earlywithdraw fee that will be redistributed
  uint256 public redistributionBps;

  // Accumulated token to be redistributed from earlywithdraw
  uint256 public accumRedistribute;

  // lock amount of each user
  mapping(address => uint256) public userLockAmounts;

  // unlock request of each user
  mapping(address => UnlockRequest[]) public userUnlockRequests;

  // whitelisted address for calling redistribute
  mapping(address => bool) public whitelistedRedistributors;

  modifier onlyRedistributors() {
    if (!whitelistedRedistributors[msg.sender]) {
      revert xALPACAv2_Unauthorized();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _token,
    address _revenueDistributor,
    uint256 _delayUnlockTime,
    address _feeTreasury,
    uint256 _earlyWithdrawFeeBpsPerDay,
    uint256 _redistributionBps
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    // sanity check
    IBEP20(_token).decimals();
    IxALPACAv2RevenueDistributor(_revenueDistributor).stakingReserve();

    // max lock time = 365 day
    if (_delayUnlockTime > 365 days) {
      revert xALPACAv2_TooMuchDelay();
    }

    if (_feeTreasury == address(0) || _feeTreasury == address(this)) {
      revert xALPACAv2_InvalidAddress();
    }

    // fee should not cost more than 100%
    if (((_earlyWithdrawFeeBpsPerDay * _delayUnlockTime) / 1 days) > 10000) {
      revert xALPACAv2_TooMuchFee();
    }

    feeTreasury = _feeTreasury;
    earlyWithdrawFeeBpsPerDay = _earlyWithdrawFeeBpsPerDay;
    delayUnlockTime = _delayUnlockTime;
    token = _token;
    revenueDistributor = _revenueDistributor;
    redistributionBps = _redistributionBps;
  }

  /// @notice Lock token to receive voting power
  /// @param _for The user to create lock
  /// @param _amount The amount of token to be locked
  function lock(address _for, uint256 _amount) external nonReentrant {
    // effect
    userLockAmounts[_for] += _amount;
    totalLocked += _amount;
    // interaction
    token.safeTransferFrom(msg.sender, address(this), _amount);

    token.safeApprove(revenueDistributor, _amount);
    IxALPACAv2RevenueDistributor(revenueDistributor).deposit(_for, _amount);

    emit LogLock(_for, _amount);
  }

  /// @notice Initiate withdrawal process via delayed unlocking
  /// @param _amount The amount to unlock
  function unlock(uint256 _amount) external nonReentrant returns (uint256 _unlockRequestId) {
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
      status: UnlockStatus.INITIATED
    });

    if (breaker == 0) {
      UnlockRequest[] storage _userRequests = userUnlockRequests[msg.sender];

      _unlockRequestId = _userRequests.length;

      _userRequests.push(_request);
      // interaction
      IxALPACAv2RevenueDistributor(revenueDistributor).withdraw(msg.sender, _amount);

      emit LogUnlock(msg.sender, _unlockRequestId);
    } else {
      IxALPACAv2RevenueDistributor(revenueDistributor).withdraw(msg.sender, _amount);
      token.safeTransfer(msg.sender, _amount);
    }
  }

  /// @notice Claim the unlocked ALPACA
  /// @param _unlockRequestId The id of request to withdraw from
  function withdraw(uint256 _unlockRequestId) external nonReentrant {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != UnlockStatus.INITIATED) {
      revert xALPACAv2_InvalidStatus();
    }

    // revert if it's not unlock time yet
    if (request.unlockTimestamp > block.timestamp) {
      revert xALPACAv2_UnlockTimeUnreached();
    }

    // effect
    request.status = UnlockStatus.CLAIMED;

    // interaction
    token.safeTransfer(msg.sender, request.amount);

    emit LogWithdraw(msg.sender, request.amount);
  }

  /// @notice Premature withdrawal before unlock completed
  /// @param _unlockRequestId The id of request to withdraw from
  function earlyWithdraw(uint256 _unlockRequestId) external nonReentrant {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != UnlockStatus.INITIATED) {
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

    // if early withdraw fee is greater than amount, should revert here
    uint256 _amountToUser = request.amount - _earlyWithdrawalFee;
    uint256 _amountToRedistribute = (_earlyWithdrawalFee * redistributionBps) / 10000;
    uint256 _amountToTreasury = _earlyWithdrawalFee - _amountToRedistribute;

    accumRedistribute += _amountToRedistribute;
    request.status = UnlockStatus.CLAIMED;

    // interaction
    token.safeTransfer(msg.sender, _amountToUser);
    token.safeTransfer(feeTreasury, _amountToTreasury);

    emit LogWithdraw(msg.sender, _amountToUser);
    emit LogEarlyWithdraw(msg.sender, _amountToTreasury, _amountToRedistribute);
  }

  /// @notice Redistribute accumulated token from earlywithdraw back to revenueDistributor
  function redistribute() external onlyRedistributors nonReentrant {
    uint256 _amount = accumRedistribute;

    accumRedistribute = 0;

    token.safeApprove(revenueDistributor, _amount);

    // redistribute to revenueDistributor without chaging reward end timestamp
    IxALPACAv2RevenueDistributor(revenueDistributor).feed(
      _amount,
      IxALPACAv2RevenueDistributor(revenueDistributor).rewardEndTimestamp()
    );

    emit LogRedistribute(msg.sender, revenueDistributor, _amount);
  }

  /// @notice Reverse the withdrawal unlocking process
  /// @param _unlockRequestId The id of request to cancel
  function cancelUnlock(uint256 _unlockRequestId) external nonReentrant {
    UnlockRequest storage request = userUnlockRequests[msg.sender][_unlockRequestId];

    // check
    // revert if it's already claimed or canceled
    if (request.status != UnlockStatus.INITIATED) {
      revert xALPACAv2_InvalidStatus();
    }

    // effect
    totalLocked += request.amount;
    userLockAmounts[msg.sender] += request.amount;
    request.status = UnlockStatus.CANCELED;

    // interaction
    token.safeApprove(revenueDistributor, request.amount);
    IxALPACAv2RevenueDistributor(revenueDistributor).deposit(msg.sender, request.amount);

    emit LogUnlock(msg.sender, _unlockRequestId);
  }

  /// @notice Transfer xALAPCA to another address
  /// @param _destination The destination address
  /// @param _amount The amount to transfer
  function transfer(address _destination, uint256 _amount) external nonReentrant {
    // Check
    if (_destination == address(this) || _destination == address(0) || _destination == msg.sender) {
      revert xALPACAv2_InvalidAddress();
    }

    uint256 _userLockedAmount = userLockAmounts[msg.sender];
    if (_userLockedAmount < _amount || _amount == 0) {
      revert xALPACAv2_InvalidAmount();
    }

    // Effect
    userLockAmounts[msg.sender] -= _amount;
    userLockAmounts[_destination] += _amount;

    // Interaction
    IxALPACAv2RevenueDistributor(revenueDistributor).withdraw(msg.sender, _amount);
    token.safeApprove(revenueDistributor, _amount);
    IxALPACAv2RevenueDistributor(revenueDistributor).deposit(_destination, _amount);

    emit LogTransfer(msg.sender, _destination, _amount);
  }

  // -------- Privilege Functions -----//

  /// @notice Owner set the delayed unlock time
  /// @param _newDelayUnlockTime Time delay in seconds needed for withdrawal
  function setDelayUnlockTime(uint256 _newDelayUnlockTime) external onlyOwner {
    // check
    if (_newDelayUnlockTime > 365 days) {
      revert xALPACAv2_TooMuchDelay();
    }

    emit LogSetDelayUnlockTime(delayUnlockTime, _newDelayUnlockTime);

    delayUnlockTime = _newDelayUnlockTime;
  }

  /// @notice Owner set early withdraw fee bps per day
  /// @param _newFeePerPerDay The new early withdrawal bps per day
  function setEarlyWithdrawFeeBpsPerDay(uint256 _newFeePerPerDay) external onlyOwner {
    // check
    // fee should not cost more than 100%
    if (((_newFeePerPerDay * delayUnlockTime) / 1 days) > 10000) {
      revert xALPACAv2_TooMuchFee();
    }

    emit LogSetEarlyWithdrawFeeBpsPerDay(earlyWithdrawFeeBpsPerDay, _newFeePerPerDay);
    earlyWithdrawFeeBpsPerDay = _newFeePerPerDay;
  }

  /// @notice Owner set redistribution bps
  /// @param _newRedistributionBps The new portion from earlywithdraw fee that will be redistributed
  function setRedistributionBps(uint256 _newRedistributionBps) external onlyOwner {
    if (_newRedistributionBps > 10000) {
      revert xALPACAv2_InvalidParams();
    }

    redistributionBps = _newRedistributionBps;

    emit LogSetRedistributionBps(msg.sender, _newRedistributionBps);
  }

  /// @notice Owner set new treasury address
  /// @param _newFeeTreasury The new address that will receive early withdrawal fee
  function setFeeTreasury(address _newFeeTreasury) external onlyOwner {
    if (_newFeeTreasury == address(0) || _newFeeTreasury == address(this)) {
      revert xALPACAv2_InvalidAddress();
    }
    emit LogSetFeeTreasury(feeTreasury, _newFeeTreasury);
    feeTreasury = _newFeeTreasury;
  }

  /// @dev Owner enable emergency withdraw
  /// @param _breaker The new value of breaker 0 if off, 1 if on
  function setBreaker(uint256 _breaker) external onlyOwner {
    if (_breaker > 1) {
      revert xALPACAv2_InvalidBreakerValue();
    }
    emit LogSetBreaker(breaker, _breaker);
    breaker = _breaker;

    // waive early withdraw fee
    emit LogSetEarlyWithdrawFeeBpsPerDay(earlyWithdrawFeeBpsPerDay, 0);
    earlyWithdrawFeeBpsPerDay = 0;
  }

  function setWhitelistedRedistributors(address[] calldata _callers, bool _ok) external onlyOwner {
    uint256 _length = _callers.length;
    for (uint256 _idx = 0; _idx < _length; ) {
      whitelistedRedistributors[_callers[_idx]] = _ok;
      emit LogSetWhitelistedRedistributors(_msgSender(), _callers[_idx], _ok);
      unchecked {
        _idx++;
      }
    }
  }

  // -------- View Functions --------//

  function userUnlockRequestsLastId(address _user) external view returns (uint256) {
    return userUnlockRequests[_user].length;
  }
}
