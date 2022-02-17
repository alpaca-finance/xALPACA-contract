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
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract MockAnySwapV4Router {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  function anySwapOutUnderlying(
    address token,
    address, /* to*/
    uint256 amount,
    uint256 /* toChainID */
  ) external {
    IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);
  }
}