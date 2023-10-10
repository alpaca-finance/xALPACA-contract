// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { BaseTest, console, ProxyAdminLike } from "../base/BaseTest.sol";

import { xALPACAMigrator } from "contracts/8.10/xALPACAMigrator.sol";
import { xALPACA } from "contracts/8.10/xALPACA.sol";

contract xALPACAMigrator_BaseTest is BaseTest {
  address internal alpaca = 0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F;
  address internal deployer = 0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51;
  address internal timelock = 0x2D5408f2287BF9F9B05404794459a846651D0a59;
  address internal _proxyAdmin = 0x5379F32C8D5F663EACb61eeF63F722950294f452;
  address internal xAlpaca = 0xB7d85Ab25b9D478961face285fa3D8AAecAd24a9;

  xALPACAMigrator internal xalpacaMigrator;

  function setUp() public virtual {
    vm.createSelectFork(vm.envString("BSC_MAINNET_RPC"), 32474181);

    deal(xALPACA(xAlpaca).ALP, address(this), 10000e18);

    xALPACAMigrator xalpacaMigratorImp = new xALPACAMigrator();

    vm.prank(timelock);
    ProxyAdminLike(_proxyAdmin).upgrade(xAlpaca, address(xalpacaMigratorImp));
  }
}
