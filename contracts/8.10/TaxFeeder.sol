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

  /// @notice Errors
  error TaxFeeder_TooMuchTaxBps(uint64 _updatedTaxBps);
  error TaxFeeder_TooSmallTaxAmount(uint256 _taxAmount, uint256 _minTaxAmount);
  error TaxFeeder_InvalidInitializedAddress();

  /// @notice Events
  event LogFeed(address _to, uint256 _amount);
  event LogTax(address _to, uint256 _chainId, uint256 _amount);
  event LogSetTaxBps(uint64 _updatedTaxBps);
  event LogSetMinTaxAmount(uint256 _updatedMinTaxAmount);

  /// @notice Configurable variable
  uint64 public taxBps;
  uint256 public minTaxAmount;

  /// @notice State
  IERC20Upgradeable public token;
  IAnyswapV4Router public anySwapRouter;
  address public alpacaFeeder;

  address public taxCollector;
  uint256 public taxCollectorChainId;

  /// @notice Constants
  uint64 private constant BASIS_POINT = 10000;

  function initialize(
    IERC20Upgradeable _token,
    address _alpacaFeeder,
    IAnyswapV4Router _anySwapRouter,
    address _taxCollector,
    uint256 _taxCollectorChainId,
    uint64 _taxBps,
    uint256 _minTaxAmount
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    // check contracts address should not be zero address
    if (address(_token) == address(0)) revert TaxFeeder_InvalidInitializedAddress();
    if (address(_anySwapRouter) == address(0)) revert TaxFeeder_InvalidInitializedAddress();
    if (_alpacaFeeder == address(0)) revert TaxFeeder_InvalidInitializedAddress();
    if (_taxCollector == address(0)) revert TaxFeeder_InvalidInitializedAddress();

    token = _token;
    alpacaFeeder = _alpacaFeeder;
    anySwapRouter = _anySwapRouter;

    taxCollector = _taxCollector;
    taxCollectorChainId = _taxCollectorChainId;

    setTaxBps(_taxBps);
    minTaxAmount = _minTaxAmount;
  }

  /// @notice feed to alpaca feeder
  function feed() external {
    uint256 _rewardAmount = token.balanceOf(address(this));
    uint256 _feedTaxAmount = (_rewardAmount * taxBps) / BASIS_POINT;

    // prevent bridge token if _feedTaxAmount is too small
    if (_feedTaxAmount < minTaxAmount) revert TaxFeeder_TooSmallTaxAmount(_feedTaxAmount, minTaxAmount);

    token.approve(address(anySwapRouter), _feedTaxAmount);
    anySwapRouter.anySwapOutUnderlying(address(token), taxCollector, _feedTaxAmount, taxCollectorChainId);
    token.approve(address(anySwapRouter), 0);

    // transfer reward to alpaca feeder
    uint256 _feedAmount = _rewardAmount - _feedTaxAmount;
    token.safeTransfer(alpacaFeeder, _feedAmount);

    emit LogFeed(alpacaFeeder, _feedAmount);
    emit LogTax(taxCollector, taxCollectorChainId, _feedTaxAmount);
  }

  /// @notice set tax bps, should not exceed.
  /// @param _taxBps Tax bps that would be set.
  function setTaxBps(uint64 _taxBps) public onlyOwner {
    // tax bps should not set exceed 40%
    if (_taxBps > 4000) revert TaxFeeder_TooMuchTaxBps(_taxBps);
    taxBps = _taxBps;
    emit LogSetTaxBps(_taxBps);
  }

  /// @notice set minimum tax amount to prevent too small bridge token to another chain.
  /// @param _minTaxAmount Tax bps that would be set.
  function setMinTaxAmount(uint64 _minTaxAmount) public onlyOwner {
    minTaxAmount = _minTaxAmount;
    emit LogSetMinTaxAmount(_minTaxAmount);
  }
}
