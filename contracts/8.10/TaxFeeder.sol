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
 *
 */

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
  error TaxFeeder_TaxBpsTooHigh(uint64 _updatedTaxBps);
  error TaxFeeder_RewardAmountTooSmall(uint256 _rewardAmount, uint256 _minRewardAmount);

  /// @notice Events
  event LogFeed(address _to, uint256 _amount);
  event LogTax(address _to, uint256 _chainId, uint256 _amount);
  event LogSetTaxBps(uint64 _updatedTaxBps);
  event LogSetMinRewardAmount(uint256 _updatedMinRewardAmount);

  /// @notice Configurable variable
  uint64 public taxBps;
  uint256 public minRewardAmount;

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
    uint256 _minRewardAmount
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    // Call view function to Check contracts
    _token.balanceOf(address(this));
    _anySwapRouter.mpc();

    token = _token;
    alpacaFeeder = _alpacaFeeder;
    anySwapRouter = _anySwapRouter;

    taxCollector = _taxCollector;
    taxCollectorChainId = _taxCollectorChainId;

    setTaxBps(_taxBps);
    minRewardAmount = _minRewardAmount;
  }

  /// @notice feed to alpaca feeder
  function feed() external {
    uint256 _rewardAmount = token.balanceOf(address(this));
    uint256 _feedTaxAmount = (_rewardAmount * taxBps) / BASIS_POINT;
    uint256 _feedAmount = _rewardAmount - _feedTaxAmount;

    // Check
    // prevent bridge token if _feedTaxAmount is too small
    if (_rewardAmount < minRewardAmount) revert TaxFeeder_RewardAmountTooSmall(_rewardAmount, minRewardAmount);

    // Interaction
    // brige token to tax collector chain
    token.approve(address(anySwapRouter), _feedTaxAmount);
    anySwapRouter.anySwapOutUnderlying(address(token), taxCollector, _feedTaxAmount, taxCollectorChainId);

    // transfer reward to alpaca feeder
    token.safeTransfer(alpacaFeeder, _feedAmount);

    emit LogFeed(alpacaFeeder, _feedAmount);
    emit LogTax(taxCollector, taxCollectorChainId, _feedTaxAmount);
  }

  /// @notice set tax bps, should not exceed.
  /// @param _taxBps Tax bps that would be set.
  function setTaxBps(uint64 _taxBps) public onlyOwner {
    // Check
    // tax bps should not set exceed 40%
    if (_taxBps > 4000) revert TaxFeeder_TaxBpsTooHigh(_taxBps);

    // Effect
    taxBps = _taxBps;

    emit LogSetTaxBps(_taxBps);
  }

  /// @notice set minimum reward amount to prevent too small bridge token to another chain.
  /// @param _minRewardAmount Minimum reward amount that would be set.
  function setMinRewardAmount(uint256 _minRewardAmount) public onlyOwner {
    // Effect
    minRewardAmount = _minRewardAmount;

    emit LogSetMinRewardAmount(_minRewardAmount);
  }
}
