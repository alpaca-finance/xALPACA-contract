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

interface IMiniFL {
  function stakingToken(uint256 _pid) external view returns (IERC20Upgradeable);

  function deposit(address _for, uint256 _pid, uint256 _amount) external;

  function harvest(uint256 _pid) external;

  function withdraw(address _for, uint256 _pid, uint256 _amount) external;
}
