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
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/IxALPACA.sol";
import "./interfaces/IBEP20.sol";

import "./SafeToken.sol";

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

  uint256 public startTime;
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
    startTime = _startTimeFloorWeek;
    lastTokenTimestamp = _startTimeFloorWeek;
    weekCursor = _startTimeFloorWeek;
    rewardToken = _rewardToken;
    xALPACA = _xALPACA;
    emergencyReturn = _emergencyReturn;
  }

  /// @notice Record checkpoint
  function _checkpointToken() internal {
    uint256 _rewardTokenBalance = rewardToken.myBalance();
    uint256 _toDistribute = _rewardTokenBalance.sub(tokenLastBalance);

    uint256 _weekCursor = lastTokenTimestamp;
    uint256 _deltaSinceLastTimestamp = block.timestamp.sub(_weekCursor);
    lastTokenTimestamp = block.timestamp;

    uint256 _thisWeek = _timestampToFloorWeek(_weekCursor);
    uint256 _nextWeek = 0;

    for (uint256 i = 0; i < 20; i++) {
      _nextWeek = _thisWeek.add(WEEK);
      if (block.timestamp < _nextWeek) {
        if (_deltaSinceLastTimestamp == 0 && block.timestamp == _weekCursor) {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(_toDistribute);
        } else {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(
            (_toDistribute.mul(block.timestamp.sub(_weekCursor)).div(_deltaSinceLastTimestamp))
          );
        }
        break;
      } else {
        if (_deltaSinceLastTimestamp == 0 && _nextWeek == _weekCursor) {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(_toDistribute);
        } else {
          tokensPerWeek[_thisWeek] = tokensPerWeek[_thisWeek].add(
            (_toDistribute.mul(_nextWeek.sub(_weekCursor)).div(_deltaSinceLastTimestamp))
          );
        }
      }
      _weekCursor = _nextWeek;
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

  /// @notice Round off random timestamp to week
  /// @param _timestamp The timestamp to be rounded off
  function _timestampToFloorWeek(uint256 _timestamp) internal pure returns (uint256) {
    return (_timestamp / WEEK).mul(WEEK);
  }
}
