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

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./interfaces/IxALPACA.sol";
import "./interfaces/IBEP20.sol";

import "./SafeToken.sol";

import "hardhat/console.sol";

/// @title GrassHouse - Where Alpaca eats
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase
contract GrassHouse is Ownable, ReentrancyGuard {
  using SafeToken for address;
  using SafeMath for uint256;

  /// @dev Events
  event LogToggleAllowCheckpointToken(bool _toggleFlag);
  event LogCheckpointToken(uint256 _timestamp, uint256 _tokens);
  event LogClaimed(address indexed _recipient, uint256 _amount, uint256 _claimEpoch, uint256 _maxEpoch);

  /// @dev Time-related constants
  uint256 public constant WEEK = 1 weeks;
  uint256 public constant TOKEN_CHECKPOINT_DEADLINE = 1 days;

  uint256 public startWeekCursor;
  uint256 public weekCursor;
  mapping(address => uint256) public weekCursorOf;
  mapping(address => uint256) public userEpochOf;

  uint256 public lastTokenTimestamp;
  mapping(uint256 => uint256) public tokensPerWeek;

  address public xALPACA;
  address public rewardToken;
  uint256 public totalReceived;
  uint256 public tokenLastBalance;

  /// @dev xALPACA supply at week bounds
  mapping(uint256 => uint256) public xSupply;

  bool public canCheckpointToken;

  /// @dev address to get token when contract is emergency stop
  address public emergencyReturn;

  /// @notice Constructor to instaniate GrassHouse
  /// @param _xALPACA The address of xALPACA
  /// @param _startTime Time to be started
  /// @param _rewardToken The token to be distributed
  /// @param _emergencyReturn The address to return token when emergency stop
  constructor(
    address _xALPACA,
    uint256 _startTime,
    address _rewardToken,
    address _emergencyReturn
  ) {
    uint256 _startTimeFloorWeek = _timestampToFloorWeek(_startTime);
    startWeekCursor = _startTimeFloorWeek;
    lastTokenTimestamp = _startTimeFloorWeek;
    weekCursor = _startTimeFloorWeek;
    rewardToken = _rewardToken;
    xALPACA = _xALPACA;
    emergencyReturn = _emergencyReturn;
  }

  /// @notice Record token distribution checkpoint
  function _checkpointToken() internal {
    // Find out how many tokens to be distributed
    uint256 _rewardTokenBalance = rewardToken.myBalance();
    uint256 _toDistribute = _rewardTokenBalance.sub(tokenLastBalance);

    // Prepare and update time-related variables
    // 1. Setup _timeCursor to be the "lastTokenTimestamp"
    // 2. Find out how long from previous checkpoint
    // 3. Setup iterable cursor
    // 4. Update lastTokenTimestamp to be block.timestamp
    uint256 _timeCursor = lastTokenTimestamp;
    uint256 _deltaSinceLastTimestamp = block.timestamp.sub(_timeCursor);
    uint256 _thisWeek = _timestampToFloorWeek(_timeCursor);
    uint256 _nextWeek = 0;
    lastTokenTimestamp = block.timestamp;

    console.log("_deltaSinceLastTimestamp: ", _deltaSinceLastTimestamp);
    console.log("_thisWeek: ", _thisWeek);

    // Iterate through weeks to filled out missing tokensPerWeek (if any)
    for (uint256 i = 0; i < 20; i++) {
      _nextWeek = _thisWeek.add(WEEK);
      if (block.timestamp < _nextWeek) {
        if (_deltaSinceLastTimestamp == 0 && block.timestamp == _timeCursor) {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(_toDistribute);
        } else {
          console.log(
            "[block.timestamp < _nextWeek & not block] tokensPerWeek: ",
            _toDistribute.mul(block.timestamp.sub(_timeCursor)).div(_deltaSinceLastTimestamp)
          );
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(
            (_toDistribute.mul(block.timestamp.sub(_timeCursor)).div(_deltaSinceLastTimestamp))
          );
        }
        break;
      } else {
        if (_deltaSinceLastTimestamp == 0 && _nextWeek == _timeCursor) {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(_toDistribute);
        } else {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(
            (_toDistribute.mul(_nextWeek.sub(_timeCursor)).div(_deltaSinceLastTimestamp))
          );
        }
      }
      _timeCursor = _nextWeek;
      _thisWeek = _nextWeek;
    }

    emit LogCheckpointToken(block.timestamp, _toDistribute);
  }

  /// @notice Update token checkpoint
  /// @dev Calculate the total token to be distributed in a given week.
  /// At launch can only be called by owner, after launch can be called
  /// by anyone if block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE
  function checkpointToken() external {
    require(
      msg.sender == owner() ||
        (canCheckpointToken && (block.timestamp > lastTokenTimestamp.add(TOKEN_CHECKPOINT_DEADLINE))),
      "!allow"
    );
    _checkpointToken();
  }

  /// @notice Record xALPACA total supply
  function _checkpointTotalSupply() internal {
    uint256 _weekCursor = weekCursor;
    uint256 _roundedTimestamp = _timestampToFloorWeek(block.timestamp);

    IxALPACA(xALPACA).checkpoint();

    for (uint256 i = 0; i < 20; i++) {
      if (_weekCursor > _roundedTimestamp) {
        break;
      } else {
        uint256 _epoch = _findTimestampEpoch(_roundedTimestamp);
        Point memory _point = IxALPACA(xALPACA).pointHistory(_epoch);
        int128 _timeDelta = 0;
        if (_weekCursor > _point.timestamp) {
          _timeDelta = SafeCast.toInt128(int256(_weekCursor - _point.timestamp));
        }
        int128 _bias = _point.bias - _point.slope * _timeDelta;
        if (_bias < 0) {
          xSupply[_weekCursor] = 0;
        } else {
          xSupply[_weekCursor] = SafeCast.toUint256(_bias);
        }
      }
      _weekCursor = _weekCursor + WEEK;
    }

    weekCursor = _weekCursor;
  }

  /// @notice Update xALPACA total supply checkpint
  /// @dev This function can be called independently or at the first claim of
  /// the new epoch week.
  function checkpointTotalSupply() external {
    _checkpointTotalSupply();
  }

  /// @notice Claim rewardToken
  /// @dev Perform claim rewardToken
  function _claim(address _user, uint256 _flooredWeekLastTokenTimestamp) internal returns (uint256) {
    uint256 _userEpoch = 0;
    uint256 _toDistribute = 0;

    uint256 _maxUserEpoch = IxALPACA(xALPACA).userPointEpoch(_user);
    uint256 _startWeekCursor = startWeekCursor;

    // _maxUserEpoch = 0, meaning no lock.
    // Hence, no yield for _user
    if (_maxUserEpoch == 0) {
      return 0;
    }

    uint256 _weekCursor = weekCursorOf[_user];
    if (_weekCursor == 0) {
      // if _user has no _weekCursor with GrassHouse yet
      // then we need to perform binary search
      _userEpoch = _findTimestampUserEpoch(_user, block.timestamp, _maxUserEpoch);
    } else {
      // else, _user must has epoch with GrassHouse already
      _userEpoch = userEpochOf[_user];
    }

    if (_userEpoch == 0) {
      _userEpoch = 1;
    }

    Point memory _userPoint = IxALPACA(xALPACA).userPointHistory(_user, _userEpoch);

    if (_weekCursor == 0) {
      _weekCursor = ((_userPoint.timestamp + WEEK - 1) / WEEK) * WEEK;
    }

    if (_weekCursor >= _flooredWeekLastTokenTimestamp) {
      return 0;
    }

    if (_weekCursor < _startWeekCursor) {
      _weekCursor = _startWeekCursor;
    }

    Point memory _prevUserPoint = Point({ bias: 0, slope: 0, timestamp: 0, blockNumber: 0 });

    // Go through weeks
    for (uint256 i = 0; i < 50; i++) {
      if (_weekCursor >= _flooredWeekLastTokenTimestamp) {
        break;
      }
      if (_weekCursor >= _userPoint.timestamp && _userEpoch <= _maxUserEpoch) {
        _userEpoch = _userEpoch + 1;
        _prevUserPoint = Point({
          bias: _userPoint.bias,
          slope: _userPoint.slope,
          timestamp: _userPoint.timestamp,
          blockNumber: _userPoint.blockNumber
        });
        if (_userEpoch > _maxUserEpoch) {
          _userPoint = Point({ bias: 0, slope: 0, timestamp: 0, blockNumber: 0 });
        } else {
          _userPoint = IxALPACA(xALPACA).userPointHistory(_user, _userEpoch);
        }
      } else {
        int128 _timeDelta = SafeCast.toInt128(int256(_weekCursor - _prevUserPoint.timestamp));
        int128 _bias = _prevUserPoint.bias - _prevUserPoint.slope * _timeDelta;
        uint256 _balanceOf = 0;
        if (_bias > 0) _balanceOf = SafeCast.toUint256(_bias);
        if (_balanceOf == 0 && _userEpoch > _maxUserEpoch) {
          break;
        }
        if (_balanceOf > 0) {
          _toDistribute = _toDistribute + (_balanceOf * tokensPerWeek[_weekCursor]) / xSupply[_weekCursor];
        }
        _weekCursor = _weekCursor + WEEK;
      }
    }

    _userEpoch = Math.min(_maxUserEpoch, _userEpoch.sub(1));
    userEpochOf[_user] = _userEpoch;
    weekCursorOf[_user] = _weekCursor;

    emit LogClaimed(_user, _toDistribute, _userEpoch, _maxUserEpoch);

    return _toDistribute;
  }

  /// @notice Claim rewardToken for "_user"
  /// @param _user The address to claim rewards for
  function claim(address _user) external nonReentrant returns (uint256) {
    if (block.timestamp >= weekCursor) _checkpointTotalSupply();

    uint256 _lastTokenTimestamp = lastTokenTimestamp;

    if (canCheckpointToken && (block.timestamp > _lastTokenTimestamp.add(TOKEN_CHECKPOINT_DEADLINE))) {
      _checkpointToken();
      _lastTokenTimestamp = block.timestamp;
    }

    _lastTokenTimestamp = _timestampToFloorWeek(_lastTokenTimestamp);

    uint256 _amount = _claim(_user, _lastTokenTimestamp);
    if (_amount != 0) {
      rewardToken.safeTransfer(_user, _amount);
      tokenLastBalance = tokenLastBalance.sub(_amount);
    }

    return _amount;
  }

  /// @notice Claim rewardToken for multiple users
  /// @param _users The array of addresses to claim reward for
  function claimMany(address[] calldata _users) external nonReentrant returns (bool) {
    require(_users.length <= 20, "!over 20 users");

    if (block.timestamp >= weekCursor) _checkpointTotalSupply();

    uint256 _lastTokenTimestamp = lastTokenTimestamp;

    if (canCheckpointToken && (block.timestamp > _lastTokenTimestamp.add(TOKEN_CHECKPOINT_DEADLINE))) {
      _checkpointToken();
      _lastTokenTimestamp = block.timestamp;
    }

    _lastTokenTimestamp = _timestampToFloorWeek(_lastTokenTimestamp);
    uint256 _total = 0;

    for (uint256 i = 0; i < _users.length; i++) {
      if (_users[i] == address(0)) break;

      uint256 _amount = _claim(_users[i], _lastTokenTimestamp);
      if (_amount != 0) {
        rewardToken.safeTransfer(_users[i], _amount);
        _total = _total.add(_amount);
      }
    }

    if (_total != 0) {
      tokenLastBalance = tokenLastBalance.sub(_total);
    }

    return true;
  }

  /// @notice Receive rewardTokens into the contract and trigger token checkpoint
  function feed(uint256 _amount) external returns (bool) {
    rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
    console.log("==== feed ====");
    console.log("block.timestamp: ", block.timestamp);
    console.log("lastTokenTimestamp: ", lastTokenTimestamp);
    console.log("tokenCheckpointDeadline: ", TOKEN_CHECKPOINT_DEADLINE);

    if (canCheckpointToken && (block.timestamp > lastTokenTimestamp + TOKEN_CHECKPOINT_DEADLINE)) {
      _checkpointToken();
    }
    return true;
  }

  /// @notice Do Binary Search to find out epoch from timestamp
  /// @param _timestamp Timestamp to find epoch
  function _findTimestampEpoch(uint256 _timestamp) internal view returns (uint256) {
    uint256 _min = 0;
    uint256 _max = IxALPACA(xALPACA).epoch();
    // Loop for 128 times -> enough for 128-bit numbers
    for (uint256 i = 0; i < 128; i++) {
      if (_min >= _max) {
        break;
      }
      uint256 _mid = (_min + _max + 2) / 2;
      Point memory _point = IxALPACA(xALPACA).pointHistory(_mid);
      if (_point.timestamp <= _timestamp) {
        _min = _mid;
      } else {
        _max = _mid - 1;
      }
    }
    return _min;
  }

  /// @notice Perform binary search to find out user's epoch from the given timestamp
  /// @param _user The user address
  /// @param _timestamp The timestamp that you wish to find out epoch
  /// @param _maxUserEpoch Max epoch to find out the timestamp
  function _findTimestampUserEpoch(
    address _user,
    uint256 _timestamp,
    uint256 _maxUserEpoch
  ) internal view returns (uint256) {
    uint256 _min = 0;
    uint256 _max = _maxUserEpoch;
    for (uint256 i = 0; i < 128; i++) {
      if (_min >= _max) {
        break;
      }
      uint256 _mid = (_min + _max + 2) / 2;
      Point memory _point = IxALPACA(xALPACA).userPointHistory(_user, _mid);
      if (_point.timestamp <= _timestamp) {
        _min = _mid;
      } else {
        _max = _mid - 1;
      }
    }
    return _min;
  }

  /// @notice Set canCheckpointToken to allow random callers to call checkpointToken
  /// @param _newCanCheckpointToken The new canCheckpointToken flag
  function setCanCheckpointToken(bool _newCanCheckpointToken) external onlyOwner {
    canCheckpointToken = _newCanCheckpointToken;
    emit LogToggleAllowCheckpointToken(_newCanCheckpointToken);
  }

  /// @notice Get xALPACA balance of "_user" at "_timstamp"
  /// @param _user The user address
  /// @param _timestamp The timestamp to get user's balance
  function xBalanceAt(address _user, uint256 _timestamp) external view returns (uint256) {
    uint256 _maxUserEpoch = IxALPACA(xALPACA).userPointEpoch(_user);
    if (_maxUserEpoch == 0) {
      return 0;
    }

    uint256 _epoch = _findTimestampUserEpoch(_user, _timestamp, _maxUserEpoch);
    Point memory _point = IxALPACA(xALPACA).userPointHistory(_user, _epoch);
    int128 _bias = _point.bias - _point.slope * SafeCast.toInt128(int256(_timestamp - _point.timestamp));
    if (_bias < 0) {
      return 0;
    }
    return SafeCast.toUint256(_bias);
  }

  /// @notice Round off random timestamp to week
  /// @param _timestamp The timestamp to be rounded off
  function _timestampToFloorWeek(uint256 _timestamp) internal pure returns (uint256) {
    return (_timestamp / WEEK).mul(WEEK);
  }
}
