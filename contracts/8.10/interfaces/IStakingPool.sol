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

interface IStakingPool {
  function deposit(uint256 _pid, uint256 _amount) external;

  function exit(uint256 _pid) external;

  function claim(uint256 _pid) external;

  function getPoolToken(uint256 _pid) external returns (address);
}
