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
 */

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IStakingPool.sol";
import "../SafeToken.sol";

// FairLaunch is a smart contract for distributing ALPACA by asking user to stake the ERC20-based token.
contract MockStakingPool is IStakingPool {
  using SafeToken for address;

  // The Scientix TOKEN!
  address public scientix;
  address public proxyToken;
  uint256 public constant DEFAULT_HARVEST_AMOUNT = 10 * 1e18;

  address[] public pools;

  constructor(address _scientix, address _proxyToken) {
    scientix = _scientix;
    proxyToken = _proxyToken;
  }

  function createPool(address _stakeToken) external returns (uint256) {
    uint256 _poolId = pools.length;

    pools.push(_stakeToken);

    return _poolId;
  }

  // Deposit Staking tokens to StakingPool for scientix allocation.
  function deposit(uint256 _pid, uint256 _amount) external override {
    _pid = 0; // silence warning

    SafeToken.safeApprove(proxyToken, msg.sender, _amount);
    proxyToken.safeTransferFrom(msg.sender, address(this), _amount);
    SafeToken.safeApprove(proxyToken, msg.sender, 0);
  }

  // Withdraw and claim all reward
  function exit(uint256 _pid) external override {
    _pid = 0; // silence warning

    if (proxyToken.myBalance() > 0) {
      SafeToken.safeApprove(proxyToken, msg.sender, proxyToken.myBalance());
      proxyToken.safeTransfer(msg.sender, proxyToken.myBalance());
      SafeToken.safeApprove(proxyToken, msg.sender, 0);
    }
  }

  // Claim scientix earn from the pool.
  function claim(uint256 _pid) external override {
    _pid = 0; // silence warning

    require(DEFAULT_HARVEST_AMOUNT <= scientix.myBalance(), "wtf not enough scientix");
    SafeToken.safeApprove(scientix, msg.sender, DEFAULT_HARVEST_AMOUNT);
    scientix.safeTransfer(msg.sender, DEFAULT_HARVEST_AMOUNT);
    SafeToken.safeApprove(scientix, msg.sender, 0);
  }

  function getPoolToken(uint256 _pid) external view override returns (address) {
    return _pid >= pools.length ? address(0) : pools[_pid];
  }
}
