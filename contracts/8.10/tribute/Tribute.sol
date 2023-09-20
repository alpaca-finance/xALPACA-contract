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
 */

pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

import "./RootStorage.sol";

/// @title Tribute - A tribute to xALPACA holders on Capital chain.
// solhint-disable not-rely-on-time
contract Tribute is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  error Tribute_BadLength();
  error Tribute_Killed();
  error Tribute_OnlyKeeper();
  error Tribute_InvalidTimestamp();
  error Tribute_InvalidMerkleProof();
  error Tribute_Claimed();
  error Tribute_MerkleRootNotSet();

  uint256 public constant WEEK = 7 days;

  IERC20Upgradeable public rewardToken;
  RootStorage public rootStorage;

  mapping(uint256 => uint256) public tokensPerWeek;
  mapping(uint256 => mapping(uint256 => uint256)) public weeklyClaimedBitMap;
  uint256 public lastNotifyRewardWeekCursor;

  mapping(address => bool) public keepers;

  bool public isKilled;

  event LogDispute(uint256 timestamp, bytes32 root, uint256 totalSupplyAt);
  event LogNotifyReward(uint256 timestamp, uint256 amount);
  event LogSetKeepersOk(address[] keepers, bool ok);
  event LogClaim(uint256 timestamp, address user, uint256 amount);
  event LogKilled();

  modifier onlyLive() {
    if (isKilled) revert Tribute_Killed();
    _;
  }

  modifier onlyKeeper() {
    if (!keepers[msg.sender]) revert Tribute_OnlyKeeper();
    _;
  }

  function initialize(RootStorage _rootStorage, IERC20Upgradeable _rewardToken) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    rewardToken = _rewardToken;
    rootStorage = _rootStorage;
  }

  function _claim(
    uint256 _timestamp,
    uint256 _index,
    address _user,
    uint256 _amount,
    bytes32[] calldata _merkleProof
  ) internal returns (uint256) {
    // Check
    _timestamp = _timestampToFloorWeek(_timestamp);
    if (_timestamp >= lastNotifyRewardWeekCursor) revert Tribute_InvalidTimestamp();
    if (isClaimed(_timestamp, _index)) revert Tribute_Claimed();
    // Verify the merkle proof
    bytes32 _node = keccak256(abi.encodePacked(_index, _user, _amount));
    if (!MerkleProofUpgradeable.verify(_merkleProof, rootStorage.weeklyMerkleRoot(_timestamp), _node)) {
      revert Tribute_InvalidMerkleProof();
    }

    // Effect
    // Send the rewards
    uint256 _rewards = (tokensPerWeek[_timestamp] * _amount) / rootStorage.totalSupplyAt(_timestamp);
    _setClaimed(_timestamp, _index);

    // Interaction
    rewardToken.safeTransfer(_user, _rewards);

    emit LogClaim(_timestamp, _user, _rewards);

    return _rewards;
  }

  function claim(
    uint256 _timestamp,
    uint256 _index,
    address _user,
    uint256 _amount,
    bytes32[] calldata _merkleProof
  ) external onlyLive nonReentrant returns (uint256) {
    return _claim(_timestamp, _index, _user, _amount, _merkleProof);
  }

  function claimMany(
    uint256[] calldata _timestamps,
    uint256[] calldata indexes,
    address[] calldata _users,
    uint256[] calldata _amounts,
    bytes32[][] calldata _merkleProofs
  ) external onlyLive nonReentrant {
    if (
      _timestamps.length != indexes.length ||
      _timestamps.length != _users.length ||
      _timestamps.length != _amounts.length ||
      _timestamps.length != _merkleProofs.length
    ) revert Tribute_BadLength();

    for (uint256 i = 0; i < _timestamps.length; i++) {
      _claim(_timestamps[i], indexes[i], _users[i], _amounts[i], _merkleProofs[i]);
    }
  }

  function isClaimed(uint256 _timestamp, uint256 _index) public view returns (bool) {
    uint256 _claimedWordIndex = _index / 256;
    uint256 _claimedBitIndex = _index % 256;
    uint256 _claimedWord = weeklyClaimedBitMap[_timestamp][_claimedWordIndex];
    uint256 _mask = (1 << _claimedBitIndex);
    return _claimedWord & _mask == _mask;
  }

  function kill() external onlyOwner {
    isKilled = true;
    rewardToken.safeTransfer(owner(), rewardToken.balanceOf(address(this)));

    emit LogKilled();
  }

  function notifyReward(uint256 _amount) external onlyKeeper onlyLive nonReentrant {
    // Check
    uint256 _timestamp = _timestampToFloorWeek(block.timestamp);
    if (rootStorage.weeklyMerkleRoot(_timestamp) == 0) revert Tribute_MerkleRootNotSet();

    // Effect
    tokensPerWeek[_timestamp] = _amount;
    lastNotifyRewardWeekCursor = _timestamp;

    // Interaction
    rewardToken.safeTransferFrom(msg.sender, address(this), _amount);

    emit LogNotifyReward(_timestamp, _amount);
  }

  function setKeepersOk(address[] calldata _keepers, bool _ok) external onlyOwner {
    for (uint256 i = 0; i < _keepers.length; i++) {
      keepers[_keepers[i]] = _ok;
    }
    emit LogSetKeepersOk(_keepers, _ok);
  }

  function _setClaimed(uint256 _weekTimestamp, uint256 _index) internal {
    uint256 _claimedWordIndex = _index / 256;
    uint256 _claimedBitIndex = _index % 256;
    weeklyClaimedBitMap[_weekTimestamp][_claimedWordIndex] =
      weeklyClaimedBitMap[_weekTimestamp][_claimedWordIndex] |
      (1 << _claimedBitIndex);
  }

  function _timestampToFloorWeek(uint256 _timestamp) internal pure returns (uint256) {
    return (_timestamp / WEEK) * WEEK;
  }
}
