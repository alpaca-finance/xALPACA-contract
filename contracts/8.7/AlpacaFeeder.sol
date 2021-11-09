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
import "./interfaces/IVault.sol";

import "./SafeToken.sol";

/// @title AlpacaFeeder - The goverance token of Alpaca Finance
// solhint-disable not-rely-on-time
// solhint-disable-next-line contract-name-camelcase

contract AlpacaFeeder is IVault, Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
  /// @notice Libraries
  using SafeToken for address;

  /// @notice Events
  event LogFeedGrassHouse(uint256 _feedAmount);

  /// @notice State
  IFairLaunch public fairLaunch;
  IGrassHouse public grassHouse;
  uint256 public fairLaunchPoolId;

  /// @dev Attributes for AlcapaFeeder
  /// token - address of the token to be deposited in this contract
  /// proxyToken - just a simple ERC20 token for staking with FairLaunch
  address public override token;
  address public proxyToken;

  function initialize(
    address _token,
    address _proxyToken,
    address _fairLaunchAddress,
    uint256 _fairLaunchPoolId,
    address _grasshouseAddress
  ) public initializer {
    token = _token;
    proxyToken = _proxyToken;
    fairLaunchPoolId = _fairLaunchPoolId;
    fairLaunch = IFairLaunch(_fairLaunchAddress);
    grassHouse = IGrassHouse(_grasshouseAddress);

    SafeToken.safeApprove(proxyToken, _fairLaunchAddress, type(uint256).max);
  }

  /// @notice Stake token in FairLaunch
  function fairLaunchDeposit(uint256 _amount) external onlyOwner {
    // fairLaunch.deposit(address(this), fairLaunchPoolId, _amount);
  }

  /// @notice Un stake token in FairLaunch
  function fairLaunchWithdraw(uint256 _amount) external onlyOwner {
    // fairLaunch.withdraw(address(this), fairLaunchPoolId, _amount);
  }

  /// @notice Receive reward from FairLaunch
  function fairLaunchHarvest() external {
    _fairLaunchHarvest();
  }

  /// @notice Receive reward from FairLaunch
  function _fairLaunchHarvest() internal {
    (bool success, ) = address(fairLaunch).call(abi.encodeWithSelector(0xddc63262, fairLaunchPoolId));
  }

  /// @notice Harvest reward from FairLaunch and Feed token to a GrassHouse
  function feedGrassHouse() external {
    _fairLaunchHarvest();
    SafeToken.safeApprove(token, address(grassHouse), token.myBalance());
    grassHouse.feed(token.myBalance());
    SafeToken.safeApprove(token, address(grassHouse), 0);
    emit LogFeedGrassHouse(token.myBalance());
  }

  /// @notice Withdraw alpaca token
  function withdraw(address _to, uint256 _amount) external onlyOwner {
    token.safeTransfer(_to, _amount);
  }
}
