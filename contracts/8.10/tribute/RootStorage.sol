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

/// @title RootStorage - A place where all the merkle roots are stored
// solhint-disable not-rely-on-time
contract RootStorage is Initializable, OwnableUpgradeable {
  error RootStorage_OnlyKeeper();
  error RootStorage_MerkleRootAlreadySet();
  error RootStorage_MerkleRootNotSet();

  string public name;

  mapping(uint256 => bytes32) public weeklyMerkleRoot;
  mapping(uint256 => uint256) public totalSupplyAt;
  uint256 public lastWeekCursor;

  mapping(address => bool) public keepers;

  uint256 private constant WEEK = 7 days;

  event LogNotify(uint256 timestamp, bytes32 root, uint256 totalSupply);
  event LogDispute(uint256 timestamp, bytes32 root, uint256 totalSupply);
  event LogSetKeepersOk(address[] keepers, bool ok);

  modifier onlyKeeper() {
    if (!keepers[msg.sender]) revert RootStorage_OnlyKeeper();
    _;
  }

  function initialize(string calldata _name) external initializer {
    OwnableUpgradeable.__Ownable_init();
    name = _name;
  }

  function dispute(bytes32 _weeklyMerkleRoot, uint256 _totalSupply) external onlyOwner {
    // Check
    uint256 _timestamp = _timestampToFloorWeek(block.timestamp);
    if (weeklyMerkleRoot[_timestamp] == 0) revert RootStorage_MerkleRootNotSet();

    // Effect
    weeklyMerkleRoot[_timestamp] = _weeklyMerkleRoot;
    totalSupplyAt[_timestamp] = _totalSupply;

    emit LogDispute(_timestamp, _weeklyMerkleRoot, _totalSupply);
  }

  function notify(bytes32 _weeklyMerkleRoot, uint256 _totalSupply) external onlyKeeper {
    // Check
    uint256 _timestamp = _timestampToFloorWeek(block.timestamp);
    if (weeklyMerkleRoot[_timestamp] != 0) revert RootStorage_MerkleRootAlreadySet();

    // Effect
    weeklyMerkleRoot[_timestamp] = _weeklyMerkleRoot;
    totalSupplyAt[_timestamp] = _totalSupply;

    emit LogNotify(_timestamp, _weeklyMerkleRoot, _totalSupply);
  }

  function setKeepersOk(address[] calldata _keepers, bool _ok) external onlyOwner {
    for (uint256 i = 0; i < _keepers.length; i++) {
      keepers[_keepers[i]] = _ok;
    }
    emit LogSetKeepersOk(_keepers, _ok);
  }

  function _timestampToFloorWeek(uint256 _timestamp) internal pure returns (uint256) {
    return (_timestamp / WEEK) * WEEK;
  }
}
