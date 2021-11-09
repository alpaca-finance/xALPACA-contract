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
*/

pragma solidity 0.8.7;

import "../interfaces/IFairLaunch.sol";
import "../SafeToken.sol";

// FairLaunch is a smart contract for distributing ALPACA by asking user to stake the ERC20-based token.
contract MockFairLaunch is IFairLaunch {
  using SafeToken for address;

  // The Alpaca TOKEN!
  address public alpaca;
  uint256 public constant DEFAULT_HARVEST_AMOUNT = 10 * 1e18;

  constructor(address _alpaca) {
    alpaca = _alpaca;
  }

  // Deposit Staking tokens to FairLaunchToken for ALPACA allocation.
  function deposit(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) external override {
    // PoolInfo storage pool = poolInfo[_pid];
    // UserInfo storage user = userInfo[_pid][_for];
    // if (user.fundedBy != address(0)) require(user.fundedBy == msg.sender, "bad sof");
    // require(pool.stakeToken != address(0), "deposit: not accept deposit");
    // updatePool(_pid);
    // if (user.amount > 0) _harvest(_for, _pid);
    // if (user.fundedBy == address(0)) user.fundedBy = msg.sender;
    // IERC20(pool.stakeToken).safeTransferFrom(address(msg.sender), address(this), _amount);
    // user.amount = user.amount.add(_amount);
    // user.rewardDebt = user.amount.mul(pool.accAlpacaPerShare).div(1e12);
    // user.bonusDebt = user.amount.mul(pool.accAlpacaPerShareTilBonusEnd).div(1e12);
    // emit Deposit(msg.sender, _pid, _amount);
  }

  // Withdraw Staking tokens from FairLaunchToken.
  function withdraw(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) external override {
    _withdraw(_for, _pid, _amount);
  }

  function withdrawAll(address _for, uint256 _pid) external override {
    _withdraw(_for, _pid, 0);
  }

  function _withdraw(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) internal {
    // PoolInfo storage pool = poolInfo[_pid];
    // UserInfo storage user = userInfo[_pid][_for];
    // require(user.fundedBy == msg.sender, "only funder");
    // require(user.amount >= _amount, "withdraw: not good");
    // updatePool(_pid);
    // _harvest(_for, _pid);
    // user.amount = user.amount.sub(_amount);
    // user.rewardDebt = user.amount.mul(pool.accAlpacaPerShare).div(1e12);
    // user.bonusDebt = user.amount.mul(pool.accAlpacaPerShareTilBonusEnd).div(1e12);
    // if (user.amount == 0) user.fundedBy = address(0);
    // if (pool.stakeToken != address(0)) {
    //   IERC20(pool.stakeToken).safeTransfer(address(msg.sender), _amount);
    // }
    // emit Withdraw(msg.sender, _pid, user.amount);
  }

  // Harvest ALPACAs earn from the pool.
  function harvest(uint256 _pid) external override {
    require(DEFAULT_HARVEST_AMOUNT <= alpaca.myBalance(), "wtf not enough alpaca");
    SafeToken.safeApprove(alpaca, msg.sender, DEFAULT_HARVEST_AMOUNT);
    alpaca.safeTransfer(msg.sender, DEFAULT_HARVEST_AMOUNT);
    SafeToken.safeApprove(alpaca, msg.sender, 0);
  }
}
