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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IBEP20.sol";
import "./interfaces/IGrassHouse.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IProxyToken.sol";
import "./interfaces/IMiniFL.sol";

import "./SafeToken.sol";

/// @title AlpacaFeeder
contract AlpacaFeeder02 is IVault, Initializable, OwnableUpgradeable {
  /// @notice Libraries
  using SafeToken for address;

  /// @notice Errors
  error AlpacaFeeder02_InvalidToken();
  error AlpacaFeeder02_InvalideRewardToken();
  error AlpacaFeeder02_Deposited();

  /// @notice Events
  event LogFeedGrassHouse(uint256 _feedAmount);
  event LogMiniFLDeposit();
  event LogMiniFLWithdraw();
  event LogMiniFLHarvest(address _caller, uint256 _harvestAmount);
  event LogSetNewGrassHouse(address indexed _caller, address _prevGrassHouse, address _newGrassHouse);

  /// @notice State
  IMiniFL public miniFL;
  IGrassHouse public grassHouse;
  uint256 public miniFLPoolId;

  /// @notice Attributes for AlcapaFeeder
  /// token - address of the token to be deposited in this contract
  /// proxyToken - just a simple ERC20 token for staking with FairLaunch
  address public override token;
  address public proxyToken;

  function initialize(
    address _token,
    address _proxyToken,
    address _miniFLAddress,
    uint256 _miniFLPoolId,
    address _grasshouseAddress
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    token = _token;
    proxyToken = _proxyToken;
    miniFLPoolId = _miniFLPoolId;
    miniFL = IMiniFL(_miniFLAddress);
    grassHouse = IGrassHouse(_grasshouseAddress);

    address _stakeToken = address(miniFL.stakingToken(_miniFLPoolId));

    if (_stakeToken != _proxyToken) revert AlpacaFeeder02_InvalidToken();
    if (grassHouse.rewardToken() != _token) revert AlpacaFeeder02_InvalideRewardToken();

    proxyToken.safeApprove(_miniFLAddress, type(uint256).max);
  }

  /// @notice Deposit token to MiniFL
  function miniFLDeposit() external onlyOwner {
    if (IBEP20(proxyToken).balanceOf(address(miniFL)) != 0) revert AlpacaFeeder02_Deposited();
    IProxyToken(proxyToken).mint(address(this), 1e18);
    miniFL.deposit(address(this), miniFLPoolId, 1e18);
    emit LogMiniFLDeposit();
  }

  /// @notice Withdraw all staked token from MiniFL
  function miniFLWithdraw() external onlyOwner {
    miniFL.withdraw(address(this), miniFLPoolId, 1e18);
    IProxyToken(proxyToken).burn(address(this), proxyToken.myBalance());
    emit LogMiniFLWithdraw();
  }

  /// @notice Receive reward from MiniFL
  function miniFLHarvest() external {
    _miniFLHarvest();
  }

  /// @notice Receive reward from MiniFL
  function _miniFLHarvest() internal {
    uint256 _before = token.myBalance();
    (bool _success, ) = address(miniFL).call(abi.encodeWithSelector(0xddc63262, miniFLPoolId));
    if (_success) emit LogMiniFLHarvest(address(this), token.myBalance() - _before);
  }

  /// @notice Harvest reward from MiniFL and Feed token to a GrassHouse
  function feedGrassHouse() external {
    _miniFLHarvest();
    uint256 _feedAmount = token.myBalance();
    token.safeApprove(address(grassHouse), _feedAmount);
    grassHouse.feed(_feedAmount);
    emit LogFeedGrassHouse(_feedAmount);
  }

  /// @notice Set a new GrassHouse
  /// @param _newGrassHouse - new GrassHouse address
  function setGrassHouse(IGrassHouse _newGrassHouse) external onlyOwner {
    address _prevGrassHouse = address(grassHouse);
    grassHouse = _newGrassHouse;
    emit LogSetNewGrassHouse(msg.sender, _prevGrassHouse, address(_newGrassHouse));
  }
}
