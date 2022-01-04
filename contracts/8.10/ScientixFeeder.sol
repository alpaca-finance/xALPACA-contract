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
import "./interfaces/IStakingPool.sol";
import "./interfaces/IGrassHouse.sol";
import "./interfaces/IProxyToken.sol";

import "./SafeToken.sol";

/// @title ScientixFeeder
contract ScientixFeeder is Initializable, OwnableUpgradeable {
  /// @notice Libraries
  using SafeToken for address;

  /// @notice Events
  event LogFeedGrassHouse(uint256 _feedAmount);
  event LogStakingPoolDeposit();
  event LogStakingPoolWithdraw();
  event LogStakingPoolClaim(address _caller, uint256 _harvestAmount);

  /// @notice State
  IStakingPool public stakingPool;
  IGrassHouse public grassHouse;
  uint256 public stakingPoolId;

  /// @notice Attributes for ScientixFeeder
  /// token - address of the token to be deposited in this contract
  /// proxyToken - just a simple ERC20 token for staking with StakingPool
  address public token;
  address public proxyToken;

  function initialize(
    address _token,
    address _proxyToken,
    address _stakingPoolAddress,
    uint256 _stakingPoolId,
    address _grasshouseAddress
  ) external initializer {
    OwnableUpgradeable.__Ownable_init();

    token = _token;
    proxyToken = _proxyToken;
    stakingPoolId = _stakingPoolId;
    stakingPool = IStakingPool(_stakingPoolAddress);
    grassHouse = IGrassHouse(_grasshouseAddress);

    address _stakeToken = address(stakingPool.getPoolToken(stakingPoolId));

    require(_stakeToken == _proxyToken, "!same stakeToken");
    require(grassHouse.rewardToken() == _token, "!same rewardToken");

    proxyToken.safeApprove(_stakingPoolAddress, type(uint256).max);
  }

  /// @notice Deposit token to StakingPool
  function stakingPoolDeposit() external onlyOwner {
    require(IBEP20(proxyToken).balanceOf(address(stakingPool)) == 0, "already deposit");
    IProxyToken(proxyToken).mint(address(this), 1e18);
    stakingPool.deposit(stakingPoolId, 1e18);
    emit LogStakingPoolDeposit();
  }

  /// @notice Withdraw all staked token from StakingPool
  function stakingPoolWithdraw() external onlyOwner {
    stakingPool.exit(stakingPoolId);
    IProxyToken(proxyToken).burn(address(this), proxyToken.myBalance());
    emit LogStakingPoolWithdraw();
  }

  /// @notice Receive reward from StakingPool
  function stakingPoolClaim() external {
    _stakingPoolClaim();
  }

  /// @notice Receive reward from StakingPool
  function _stakingPoolClaim() internal {
    uint256 _before = token.myBalance();
    // ABI Signature of claim(uint256) = 379607f5
    (bool _success, ) = address(stakingPool).call(abi.encodeWithSelector(0x379607f5, stakingPoolId));
    if (_success) emit LogStakingPoolClaim(address(this), token.myBalance() - _before);
  }

  /// @notice Harvest reward from StakingPool and Feed token to a GrassHouse
  function feedGrassHouse() external {
    _stakingPoolClaim();
    uint256 _feedAmount = token.myBalance();
    token.safeApprove(address(grassHouse), _feedAmount);
    grassHouse.feed(_feedAmount);
    emit LogFeedGrassHouse(_feedAmount);
  }
}
