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

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

contract Tribute is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  error Tribute_Killed();
  error Tribute_OnlyKeeper();
  error Tribute_InvalidParams();

  uint256 public constant WEEK = 7 days;

  IERC20Upgradeable public rewardToken;

  mapping(uint256 => uint256) public tokensPerWeek;
  mapping(uint256 => bytes32) public weeklyMerkleRoot;
  mapping(uint256 => mapping(uint256 => uint256)) public weeklyClaimedBitMap;
  mapping(uint256 => uint256) public totalSupplyAt;
  uint256 public lastNotifyRewardWeekCursor;

  mapping(address => bool) public keepers;

  bool public isKilled;

  event LogDispute(uint256 timestamp, bytes32 root, uint256 totalSupplyAt);
  event LogNotifyBalance(uint256 timestamp, bytes32 root, uint256 totalSupplyAt);
  event LogSetKeepersOk(address[] keepers, bool ok);
  event LogClaim(uint256 timestamp, address user, uint256 amount);
  event LogKilled();

  modifier onlyLive() {
    if (!isKilled) revert Tribute_Killed();
    _;
  }

  modifier onlyKeeper() {
    if (!keepers[msg.sender]) revert Tribute_OnlyKeeper();
    _;
  }

  function initialize(IERC20Upgradeable _rewardToken) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    rewardToken = _rewardToken;
  }

  function claim(
    uint256 _timestamp,
    uint256 _index,
    address _user,
    uint256 _amount,
    bytes32[] calldata _merkleProof
  ) external onlyLive nonReentrant {
    // Check
    _timestamp = _timestampToFloorWeek(_timestamp);
    if (_timestamp >= lastNotifyRewardWeekCursor) revert Tribute_InvalidParams();
    if (isClaimed(_timestamp, _index)) revert Tribute_InvalidParams();
    // Verify the merkle proof
    bytes32 _node = keccak256(abi.encodePacked(_index, _user, _amount));
    if (!MerkleProofUpgradeable.verify(_merkleProof, weeklyMerkleRoot[_timestamp], _node))
      revert Tribute_InvalidParams();

    // Effect
    // Send the rewards
    uint256 _rewards = (tokensPerWeek[_timestamp] * _amount) / totalSupplyAt[_timestamp];
    _setClaimed(_timestamp, _index);

    // Interaction
    rewardToken.safeTransfer(_user, _rewards);

    emit LogClaim(_timestamp, _user, _rewards);
  }

  function dispute(
    bytes32 _weeklyMerkleRoot,
    uint256 _rewards,
    uint256 _totalSupply
  ) external onlyOwner nonReentrant {
    // Check
    uint256 _timestamp = _timestampToFloorWeek(block.timestamp);
    if (weeklyMerkleRoot[_timestamp] == 0) revert Tribute_InvalidParams();

    // Effect
    uint256 _prevRewards = tokensPerWeek[_timestamp];
    tokensPerWeek[_timestamp] = _rewards;
    weeklyMerkleRoot[_timestamp] = _weeklyMerkleRoot;
    totalSupplyAt[_timestamp] = _totalSupply;

    // Interaction
    rewardToken.safeTransfer(msg.sender, _prevRewards);
    rewardToken.safeTransferFrom(msg.sender, address(this), _rewards);

    emit LogDispute(_timestamp, _weeklyMerkleRoot, _totalSupply);
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

  function notifyReward(
    bytes32 _weeklyMerkleRoot,
    uint256 _rewards,
    uint256 _totalSupply
  ) external onlyKeeper onlyLive nonReentrant {
    // Check
    uint256 _timestamp = _timestampToFloorWeek(block.timestamp);
    if (weeklyMerkleRoot[_timestamp] != 0) revert Tribute_InvalidParams();

    // Effect
    tokensPerWeek[_timestamp] = _rewards;
    weeklyMerkleRoot[_timestamp] = _weeklyMerkleRoot;
    totalSupplyAt[_timestamp] = _totalSupply;
    lastNotifyRewardWeekCursor = _timestamp;

    // Interaction
    rewardToken.safeTransferFrom(msg.sender, address(this), _rewards);

    emit LogNotifyBalance(_timestamp, _weeklyMerkleRoot, _totalSupply);
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
