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

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../interfaces/IMiniFL.sol";

import "../SafeToken.sol";

// FairLaunch is a smart contract for distributing ALPACA by asking user to stake the ERC20-based token.
contract MockMiniFL is IMiniFL {
  using SafeToken for address;

  // The Alpaca TOKEN!
  address public alpaca;
  address public proxyToken;
  uint256 public constant DEFAULT_HARVEST_AMOUNT = 10 * 1e18;
  IERC20Upgradeable[] public override stakingToken;

  constructor(address _alpaca, address _proxyToken) {
    alpaca = _alpaca;
    proxyToken = _proxyToken;
  }

  // Deposit Staking tokens to FairLaunchToken for ALPACA allocation.
  function deposit(address _for, uint256 _pid, uint256 _amount) external override {
    _pid = 0; // silence warning

    SafeToken.safeApprove(proxyToken, _for, _amount);
    proxyToken.safeTransferFrom(_for, address(this), _amount);
    SafeToken.safeApprove(proxyToken, _for, 0);
  }

  function withdraw(address _for, uint256 _pid, uint256 _amount) external override {
    _pid = 0; // silence warning
    _amount = 0; // silence warning

    if (proxyToken.myBalance() > 0) {
      SafeToken.safeApprove(proxyToken, _for, proxyToken.myBalance());
      proxyToken.safeTransfer(_for, proxyToken.myBalance());
      SafeToken.safeApprove(proxyToken, _for, 0);
    }
  }

  function addPool(address _stakeToken) external {
    stakingToken.push(IERC20Upgradeable(_stakeToken));
  }

  // Harvest ALPACAs earn from the pool.
  function harvest(uint256 _pid) external override {
    _pid = 0; // silence warning
    require(DEFAULT_HARVEST_AMOUNT <= alpaca.myBalance(), "wtf not enough alpaca");
    SafeToken.safeApprove(alpaca, msg.sender, DEFAULT_HARVEST_AMOUNT);
    alpaca.safeTransfer(msg.sender, DEFAULT_HARVEST_AMOUNT);
    SafeToken.safeApprove(alpaca, msg.sender, 0);
  }
}
