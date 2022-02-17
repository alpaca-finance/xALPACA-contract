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

import "./interfaces/IAnyswapV4Router.sol";

/// @title TaxFeeder
contract TaxFeeder is Initializable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  /// @notice Events
  event LogFeed(
    address _to,
    uint256 _feedAmount,
    address _taxCollector,
    uint256 _taxCollectorChainId,
    uint256 _feedTaxAmount
  );

  /// @notice Errors
  error TaxFeeder_TooMuchTaxBps(uint64 _updatedTaxBps);

  /// @notice constants
  uint64 private constant BASIS_POINT = 10000;

  /// @notice State
  IERC20Upgradeable public alpacaToken;
  IAnyswapV4Router public anySwapRouter;
  address public alpacaFeeder;

  address public taxCollector;
  uint256 public taxCollectorChainId;

  uint64 public taxBps;

  function initialize(
    IERC20Upgradeable _alpacaToken,
    address _alpacaFeeder,
    IAnyswapV4Router _anySwapRouter,
    address _taxCollector,
    uint256 _taxCollectorChainId,
    uint64 _taxBps
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    alpacaToken = _alpacaToken;
    anySwapRouter = _anySwapRouter;
    alpacaFeeder = _alpacaFeeder;

    taxCollector = _taxCollector;
    taxCollectorChainId = _taxCollectorChainId;

    setTaxBps(_taxBps);
  }

  /// @notice feed to alpaca feeder
  function feed() external {
    uint256 _rewardAmount = alpacaToken.balanceOf(address(this));

    // send tax to BSC
    uint256 _feedTaxAmount = (_rewardAmount * taxBps) / BASIS_POINT;
    alpacaToken.approve(address(anySwapRouter), _feedTaxAmount);
    anySwapRouter.anySwapOutUnderlying(address(alpacaToken), taxCollector, _feedTaxAmount, taxCollectorChainId);
    alpacaToken.approve(address(anySwapRouter), 0);

    // transfer reward to alpaca feeder
    uint256 _feedAmount = _rewardAmount - _feedTaxAmount;
    alpacaToken.safeTransfer(alpacaFeeder, _feedAmount);

    emit LogFeed(alpacaFeeder, _feedAmount, taxCollector, taxCollectorChainId, _feedTaxAmount);
  }

  /// @notice set tax bps, should not exceed.
  /// @param _taxBps Tax bps that would be set.
  function setTaxBps(uint64 _taxBps) public onlyOwner {
    // TODO: validate exceed number [dicuss maximum percentage again]
    if (_taxBps > 4000) revert TaxFeeder_TooMuchTaxBps(_taxBps);
    taxBps = _taxBps;
  }
}
