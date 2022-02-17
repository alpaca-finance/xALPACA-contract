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

pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/// @title TaxFeeder
contract TaxFeeder is Initializable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  /// @notice Events
  event Feed(address to, uint256 _feedAmount);

  /// @notice Errors
  error TaxFeeder_TooMuchTaxBps(uint64 _updatedTaxBps);

  /// @notice constants
  uint64 private constant BASIS_POINT = 10000;

  /// @notice State
  IERC20Upgradeable public alpacaToken;
  address public alpacaFeeder;
  uint256 public bridgeChainId;
  uint64 public taxBps;

  function initialize(
    IERC20Upgradeable _alpacaToken,
    address _alpacaFeeder,
    uint256 _bridgeChainId,
    uint64 _taxBps
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    alpacaToken = _alpacaToken;
    alpacaFeeder = _alpacaFeeder;
    bridgeChainId = _bridgeChainId;

    setTaxBps(_taxBps);
  }

  /// @notice feed to alpaca feeder
  function feed() external {
    uint256 _rewardAmount = alpacaToken.balanceOf(address(this));

    // send tax to BSC
    uint256 _feedTaxAmount = (_rewardAmount * taxBps) / BASIS_POINT;

    // transfer reward to alpaca feeder
    uint256 _feedAmount = _rewardAmount - _feedTaxAmount;

    alpacaToken.safeTransfer(alpacaFeeder, _feedAmount);
    emit Feed(alpacaFeeder, _feedAmount);
  }

  /// @notice set tax bps, should not exceed.
  /// @param _taxBps Tax bps that would be set.
  function setTaxBps(uint64 _taxBps) public onlyOwner {
    // TODO: validate exceed number [dicuss maximum percentage again]
    if (_taxBps > 4000) revert TaxFeeder_TooMuchTaxBps(_taxBps);
    taxBps = _taxBps;
  }
}
