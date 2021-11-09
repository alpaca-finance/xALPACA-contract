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
Ported to Solidity from: https://github.com/curvefi/curve-dao-contracts/blob/master/contracts/VotingEscrow.vy
**/

pragma solidity 0.8.7;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IBEP20.sol";
import "./interfaces/IFairLaunch.sol";
import "./interfaces/IGrassHouse.sol";

import "./SafeToken.sol";

/// @title AlpacaFeeder - The goverance token of Alpaca Finance
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase

contract AlpacaFeeder is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
  /// @notice Libraries
  using SafeToken for address;

  /// @notice Events

  /// @notice State
  /// TODO: whitelist ??
  /// QUESTION: alpaca token ??
  /// QUESTION: fair launch pool id should be fixed constant ??
  IFairLaunch fairLaunch;
  IGrassHouse grassHouse;

  address public token;

  function initialize(address _fairLaunchAddress, address _grasshouseAddress) public initializer {
    fairLaunch = IFairLaunch(_fairLaunchAddress);
    grassHouse = IGrassHouse(_grasshouseAddress);
  }

  function fairLaunchDeposit(uint256 _poolId, uint256 _amount) external onlyOwner {
    fairLaunch.deposit(address(this), _poolId, _amount);
  }

  function fairLaunchHarvest(uint256 _poolId) external onlyOwner {
    fairLaunch.harvest(_poolId);
  }

  function feedGrasshouse() external {
    uint256 _toTransfer = token.balanceOf(address(this));
    grassHouse.feed(_toTransfer);
  }

  function withdraw(address _to, uint256 _amount) external onlyOwner {
    token.safeTransfer(_to, _amount);
  }
}
