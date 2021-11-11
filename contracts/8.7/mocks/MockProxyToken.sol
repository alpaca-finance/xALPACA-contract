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

pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../interfaces/IProxyToken.sol";

import "../SafeToken.sol";

/// @title MockProxyToken
contract MockProxyToken is IProxyToken, ERC20Upgradeable, OwnableUpgradeable {
  using SafeToken for address;
  address public rewardToken;
  mapping(address => bool) public okHolders;

  function initialize(string calldata _name, string calldata _symbol) external initializer {
    OwnableUpgradeable.__Ownable_init();
    ERC20Upgradeable.__ERC20_init(_name, _symbol);
  }

  function setOkHolders(address[] memory _okHolders, bool _isOk) public override onlyOwner {
    for (uint256 idx = 0; idx < _okHolders.length; idx++) {
      okHolders[_okHolders[idx]] = _isOk;
    }
  }

  function mint(address to, uint256 amount) public override onlyOwner {
    require(okHolders[to], "debtToken::mint:: unapproved holder");
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) public override onlyOwner {
    require(okHolders[from], "debtToken::burn:: unapproved holder");
    _burn(from, amount);
  }
}
