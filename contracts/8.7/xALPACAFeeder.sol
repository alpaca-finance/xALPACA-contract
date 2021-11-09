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

import "./SafeToken.sol";

/// @title XALPACAFeeder - The goverance token of Alpaca Finance
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase

contract XALPACAFeeder is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
  /// @notice Libraries

  using SafeToken for address;

  /// @notice Events

  // fair lunch / master chef
  // grass house
  IFairLaunch fairLaunch;

  function initialize(
    address _fairLaunchAddress,
    uint256 _fairLaunchPoolId,
    address _grasshouse
  ) public initializer {
    fairLaunch = IFairLaunch(_fairLaunchAddress);
  }

  function fairLaunchDeposit(uint256 _amount) external {
    fairLaunch.deposit(address(this), fairLaunchPoolId, _amount);
  }

  function fairLaunchHarvest() external {
    fairLaunch.harvest(fairLaunchPoolId);
  }

  function feedGrasshouse() external {}

  // Deposit LP tokens to MasterChef for SUSHI allocation.
  function deposit(uint256 _pid, uint256 _amount) external {}

  // Withdraw LP tokens from MasterChef.
  function withdraw(uint256 _pid, uint256 _amount) external {}
}
