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

pragma solidity 0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./interfaces/IBEP20.sol";

import "./SafeToken.sol";

/// @title xALPACA - The goverance token of Alpaca Finance
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase
contract xALPACA is ReentrancyGuard {
  using SafeToken for address;
  using SafeMath for uint256;

  /// @dev Events
  event LogDeposit(
    address indexed locker,
    uint256 value,
    uint256 indexed lockTime,
    uint256 lockType,
    uint256 timestamp
  );
  event LogWithdraw(address indexed locker, uint256 value, uint256 timestamp);
  event LogSupply(uint256 previousSupply, uint256 supply);

  struct Point {
    int128 bias; // voting weight
    int128 slope;
    uint256 timestamp;
    uint256 blockNumber;
  }

  struct LockedBalance {
    int128 amount;
    uint256 end;
  }

  /// @dev Constants
  uint256 public constant ACTION_DEPOSIT_FOR = 0;
  uint256 public constant ACTION_CREATE_LOCK = 1;
  uint256 public constant INCREASE_LOCK_AMOUNT = 2;
  uint256 public constant INCREASE_UNLOCK_TIME = 3;

  uint256 public constant WEEK = 7 days;
  uint256 public constant MAX_LOCK = 4 * 365 days;
  uint256 public constant MULTIPLIER = 10**18;

  /// @dev State variables
  address public token;
  uint256 public supply;

  mapping(address => LockedBalance) public locks;

  uint256 public epoch;
  Point[] public pointHistory;
  mapping(address => Point[]) public userPointHistory;
  mapping(address => uint256) public userPointEpoch;
  mapping(uint256 => int128) public slopeChanges;

  string public name;
  string public symbol;
  uint256 public decimals;

  /// @notice Constructor to instaniate xALPACA
  /// @param _token The address of ALPACA token
  constructor(address _token) {
    token = _token;

    pointHistory.push(Point({ bias: 0, slope: 0, timestamp: block.timestamp, blockNumber: block.number }));

    uint256 _decimals = IBEP20(_token).decimals();
    require(_decimals <= 255, "bad decimals");
    decimals = _decimals;

    name = "xALPACA";
    symbol = "xALPACA";
  }

  /// @notice Return the voting weight of a givne user
  /// @param _user The address of a user
  function balanceOf(address _user) public view returns (uint256) {
    uint256 _epoch = userPointEpoch[_user];
    if (_epoch == 0) {
      return 0;
    }
    Point memory _lastPoint = userPointHistory[_user][_epoch];
    _lastPoint.bias =
      _lastPoint.bias -
      (_lastPoint.slope * SafeCast.toInt128(int256(block.timestamp - _lastPoint.timestamp)));
    if (_lastPoint.bias < 0) {
      _lastPoint.bias = 0;
    }
    return SafeCast.toUint256(_lastPoint.bias);
  }

  /// @notice Record global and per-user slope to checkpoint
  /// @param _address User's wallet address. Only global if 0x0
  /// @param _prevLocked User's previous locked balance and end lock time
  /// @param _newLocked User's new locked balance and end lock time
  function _checkpoint(
    address _address,
    LockedBalance memory _prevLocked,
    LockedBalance memory _newLocked
  ) internal {
    Point memory _userPrevPoint;
    Point memory _userNewPoint;

    int128 _prevSlopeDelta = 0;
    int128 _newSlopeDelta = 1;
    uint256 _epoch = epoch;

    // if not 0x0, then update user's point
    if (_address != address(0)) {
      // Calculate slopes and biases
      // Kept at zero when they have to
      if (_prevLocked.end > block.timestamp && _prevLocked.amount > 0) {
        _userPrevPoint.slope = _prevLocked.amount / SafeCast.toInt128(int256(MAX_LOCK));
        _userPrevPoint.bias = _userPrevPoint.slope * SafeCast.toInt128(int256(_prevLocked.end - block.timestamp));
      }
      if (_newLocked.end > block.timestamp && _newLocked.amount > 0) {
        _userNewPoint.slope = _newLocked.amount / SafeCast.toInt128(int256(MAX_LOCK));
        _userNewPoint.bias = _userNewPoint.slope * SafeCast.toInt128(int256(_newLocked.end - block.timestamp));
      }

      // Handle user history here
      // Do it here to prevent stack overflow
      uint256 _userEpoch = userPointEpoch[_address];
      if (_userEpoch == 0) {
        userPointHistory[_address].push(_userPrevPoint);
      }

      userPointEpoch[_address] = _userEpoch + 1;
      _userNewPoint.timestamp = block.timestamp;
      _userNewPoint.blockNumber = block.number;
      userPointHistory[_address].push(_userNewPoint);

      // Read values of scheduled changes in the slope
      // _prevLocked.end can be in the past and in the future
      // _newLocked.end can ONLY by in the FUTURE unless everything expired: than zeros
      _prevSlopeDelta = slopeChanges[_prevLocked.end];
      if (_newLocked.end != 0) {
        if (_newLocked.end == _prevLocked.end) {
          _newSlopeDelta = _prevSlopeDelta;
        } else {
          _newSlopeDelta = slopeChanges[_newLocked.end];
        }
      }
    }

    Point memory _lastPoint = Point({ bias: 0, slope: 0, timestamp: block.timestamp, blockNumber: block.number });
    if (epoch > 0) {
      _lastPoint = pointHistory[_epoch];
    }
    uint256 _lastCheckpoint = _lastPoint.timestamp;

    // initialLastPoint is used for extrapolation to calculate block number
    // (approximately, for xxxAt methods) and save them
    // as we cannot figure that out exactly from inside contract
    Point memory _initialLastPoint = _lastPoint;
    uint256 _blockSlope = 0;
    if (block.timestamp > _lastPoint.timestamp) {
      _blockSlope = (MULTIPLIER * (block.number - _lastPoint.blockNumber)) / (block.timestamp - _lastPoint.timestamp);
    }

    // If last point is already recorded in this block, slope=0
    // But that is ok because we know the block in such case

    // Go over weeks to fill history and calculate what the current point is
    uint256 _timeCursor = _timestampToFloorWeek(block.timestamp);
    for (uint256 i = 0; i < 255; i++) {
      // This logic will works for 5 years, if more than that vote power will be broken 😟
      _timeCursor = _timeCursor.add(WEEK);
      int128 _slopeDelta = 0;
      if (_timeCursor > block.timestamp) {
        _timeCursor = block.timestamp;
      } else {
        _slopeDelta = slopeChanges[_timeCursor];
      }
      int128 _biasDelta = _lastPoint.slope * SafeCast.toInt128(int256((_timeCursor.sub(_lastCheckpoint))));
      _lastPoint.bias = _lastPoint.bias - _biasDelta;
      _lastPoint.slope = _lastPoint.slope - _slopeDelta;
      if (_lastPoint.bias < 0) {
        _lastPoint.bias = 0;
      }
      if (_lastPoint.slope < 0) {
        _lastPoint.slope = 0;
      }
      _lastCheckpoint = _timeCursor;
      _lastPoint.timestamp = _timeCursor;
      _lastPoint.blockNumber =
        _initialLastPoint.blockNumber +
        (_blockSlope * (_timeCursor - _initialLastPoint.timestamp)) /
        MULTIPLIER;
      _epoch = _epoch + 1;
      if (_timeCursor == block.timestamp) {
        _lastPoint.blockNumber = block.number;
        break;
      } else {
        pointHistory.push(_lastPoint);
      }
    }

    epoch = _epoch;
    // Now pointHistory is filled until current timestamp

    if (_address != address(0)) {
      // If last point was in the block, the slope change has been applied already
      // But in such case we have 0 slope(s)
      _lastPoint.slope = _lastPoint.slope + _userNewPoint.slope - _userPrevPoint.slope;
      _lastPoint.bias = _lastPoint.bias + _userNewPoint.bias - _userPrevPoint.bias;
      if (_lastPoint.slope < 0) {
        _lastPoint.slope = 0;
      }
      if (_lastPoint.bias < 0) {
        _lastPoint.bias = 0;
      }
    }

    // Record the new point to pointHistory
    pointHistory.push(_lastPoint);

    if (_address != address(0)) {
      // Schedule the slope changes (slope is going down)
      // We substract _newSlopeDelta from `_newLocked.end`
      // and add _prevSlopeDelta to `_prevLocked.end`
      if (_prevLocked.end > block.timestamp) {
        // _prevSlopeDelta was <something> - _userPrevPoint.slope, so we cancel that
        _prevSlopeDelta = _prevSlopeDelta + _userPrevPoint.slope;
        if (_newLocked.end == _prevLocked.end) {
          // Handle the new deposit (not extension)
          _prevSlopeDelta = _prevSlopeDelta - _userNewPoint.slope;
        }
        slopeChanges[_prevLocked.end] = _prevSlopeDelta;
      }
      if (_newLocked.end > block.timestamp) {
        if (_newLocked.end > _prevLocked.end) {
          _newSlopeDelta = _newSlopeDelta - _userNewPoint.slope; // At this line old slope should gone
          slopeChanges[_newLocked.end] = _newSlopeDelta;
        }
      }
    }
  }

  /// @notice Trigger global checkpoint
  function checkpoint() external {
    LockedBalance memory empty;
    _checkpoint(address(0), empty, empty);
  }

  /// @notice Create a new lock.
  /// @dev This will crate a new lock and deposit ALPACA to xALPACA Vault
  /// @param _amount the amount that user wishes to deposit
  /// @param _unlockTime the timestamp when ALPACA get unlocked, it will be
  /// floored down to whole weeks
  function createLock(uint256 _amount, uint256 _unlockTime) external nonReentrant {
    _unlockTime = _timestampToFloorWeek(_unlockTime);
    LockedBalance memory _locked = locks[msg.sender];

    require(_amount > 0, "bad amount");
    require(_locked.amount == 0, "already lock");
    require(_unlockTime > block.timestamp, "can only lock until future");
    require(_unlockTime <= block.timestamp + MAX_LOCK, "can only lock 4 years max");

    _depositFor(msg.sender, _amount, _unlockTime, _locked, ACTION_CREATE_LOCK);
  }

  /// @notice Deposit `_amount` tokens for `_for` and add to `locks[_for]`
  /// @dev This function is used for deposit to created lock. Not for extend locktime.
  /// @param _for The address to do the deposit
  /// @param _amount The amount that user wishes to deposit
  function depositFor(address _for, uint256 _amount) external nonReentrant {
    LockedBalance memory _lock = locks[_for];

    require(_amount > 0, "bad amount");
    require(_lock.amount > 0, "user not lock yet");
    require(_lock.end > block.timestamp, "lock expired. please withdraw");

    _depositFor(_for, _amount, 0, _lock, ACTION_DEPOSIT_FOR);
  }

  /// @notice Internal function to perform deposit and lock ALPACA for a user
  /// @param _for The address to be locked and received xALPACA
  /// @param _amount The amount to deposit
  /// @param _unlockTime New time to unlock ALPACA. Pass 0 if no change.
  /// @param _lock Existed locks[_for]
  /// @param _actionType The action that user did as this internal function shared among
  /// several external functions
  function _depositFor(
    address _for,
    uint256 _amount,
    uint256 _unlockTime,
    LockedBalance memory _lock,
    uint256 _actionType
  ) internal {
    // Initiate _supplyBefore & update supply
    uint256 _supplyBefore = supply;
    supply = _supplyBefore.add(_amount);

    // Store _prevLocked
    LockedBalance memory _prevLocked = _lock;

    // Adding new lock to existing lock, or if lock is expired
    // - creating a new one
    _lock.amount = _lock.amount + SafeCast.toInt128(int256(_amount));
    if (_unlockTime != 0) {
      _lock.end = _unlockTime;
    }
    locks[_for] = _lock;

    // Handling checkpoint here
    _checkpoint(_for, _prevLocked, _lock);

    if (_amount != 0) {
      token.safeTransferFrom(_for, address(this), _amount);
    }

    emit LogDeposit(_for, _amount, _lock.end, _actionType, block.timestamp);
    emit LogSupply(_supplyBefore, supply);
  }

  function _timestampToFloorWeek(uint256 _timestamp) internal pure returns (uint256) {
    return (_timestamp / WEEK).mul(WEEK);
  }
}
