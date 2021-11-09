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
  event LogFeedGrassHouse(uint256 _feedAmount);

  /// @notice State
  /// TODO: whitelist ??
  /// QUESTION: alpaca token ??
  /// QUESTION: fair launch pool id should be fixed constant ??
  IFairLaunch public fairLaunch;
  IGrassHouse public grassHouse;
  uint256 public fairLaunchPoolId;

  address public token;

  function initialize(
    address _token,
    address _fairLaunchAddress,
    uint256 _fairLaunchPoolId,
    address _grasshouseAddress
  ) public initializer {
    token = _token;
    fairLaunchPoolId = _fairLaunchPoolId;
    fairLaunch = IFairLaunch(_fairLaunchAddress);
    grassHouse = IGrassHouse(_grasshouseAddress);
  }

  function fairLaunchDeposit(uint256 _amount) external onlyOwner {
    fairLaunch.deposit(address(this), fairLaunchPoolId, _amount);
  }

  function fairLaunchHarvest() external onlyOwner {
    fairLaunch.harvest(fairLaunchPoolId);
  }

  function feedGrassHouse(uint256 _amount) external {
    require(token.myBalance() >= _amount, "insufficient amount");
    SafeToken.safeApprove(token, address(grassHouse), _amount);
    grassHouse.feed(_amount);
    SafeToken.safeApprove(token, address(grassHouse), 0);
    emit LogFeedGrassHouse(_amount);
  }

  function withdraw(address _to, uint256 _amount) external onlyOwner {
    token.safeTransfer(_to, _amount);
  }
}
