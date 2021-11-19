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
  address public proxyToken;
  uint256 public constant DEFAULT_HARVEST_AMOUNT = 10 * 1e18;

  constructor(address _alpaca, address _proxyToken) {
    alpaca = _alpaca;
    proxyToken = _proxyToken;
  }

  // Deposit Staking tokens to FairLaunchToken for ALPACA allocation.
  function deposit(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) external override {
    SafeToken.safeApprove(proxyToken, _for, _amount);
    proxyToken.safeTransferFrom(_for, address(this), _amount);
    SafeToken.safeApprove(proxyToken, _for, 0);
  }

  function withdrawAll(address _for, uint256 _pid) external override {
    if (proxyToken.myBalance() > 0) {
      SafeToken.safeApprove(proxyToken, _for, proxyToken.myBalance());
      proxyToken.safeTransfer(_for, proxyToken.myBalance());
      SafeToken.safeApprove(proxyToken, _for, 0);
    }
  }

  // Harvest ALPACAs earn from the pool.
  function harvest(uint256 _pid) external override {
    require(DEFAULT_HARVEST_AMOUNT <= alpaca.myBalance(), "wtf not enough alpaca");
    SafeToken.safeApprove(alpaca, msg.sender, DEFAULT_HARVEST_AMOUNT);
    alpaca.safeTransfer(msg.sender, DEFAULT_HARVEST_AMOUNT);
    SafeToken.safeApprove(alpaca, msg.sender, 0);
  }
}