// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { BaseTest, console, ProxyAdminLike, xALPACAv2, xALPACAv2RevenueDistributor } from "../base/BaseTest.sol";

import { xALPACAMigrator } from "contracts/8.10/xALPACAMigrator.sol";
import { IxALPACA } from "contracts/8.10/interfaces/IxALPACA.sol";

contract xALPACAMigrator_BaseTest is BaseTest {
  address internal deployer = 0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51;
  address internal timelock = 0x2D5408f2287BF9F9B05404794459a846651D0a59;
  address internal _proxyAdmin = 0x5379F32C8D5F663EACb61eeF63F722950294f452;

  address internal alpaca = 0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F;
  address internal xAlpaca = 0xB7d85Ab25b9D478961face285fa3D8AAecAd24a9;
  uint256 internal aliceLockAmount = 10 ether;
  uint256 internal bobLockAmount = 20 ether;

  xALPACAMigrator internal xalpacaMigrator;
  xALPACAv2 internal xAlpacaV2;
  xALPACAv2RevenueDistributor internal xAlpacaV2ReveneuDistirubor;

  address internal feeTreasury = makeAddr("feeTreasury");

  function setUp() public virtual {
    vm.createSelectFork(vm.envString("BSC_MAINNET_RPC"), 32474181);

    // alice lock for 1 week
    deal(alpaca, ALICE, aliceLockAmount);
    vm.startPrank(ALICE, ALICE);
    IERC20Upgradeable(alpaca).approve(xAlpaca, aliceLockAmount);
    IxALPACA(xAlpaca).createLock(aliceLockAmount, block.timestamp + 1 weeks);
    vm.stopPrank();

    // bob lock for 2 weeks
    deal(alpaca, BOB, bobLockAmount);
    vm.startPrank(BOB, BOB);
    IERC20Upgradeable(alpaca).approve(xAlpaca, bobLockAmount);
    IxALPACA(xAlpaca).createLock(bobLockAmount, block.timestamp + 2 weeks);
    vm.stopPrank();

    // upgrade to xALPACAMigrator
    xALPACAMigrator xalpacaMigratorImp = new xALPACAMigrator();
    vm.prank(timelock);
    ProxyAdminLike(_proxyAdmin).upgrade(xAlpaca, address(xalpacaMigratorImp));
    xalpacaMigrator = xALPACAMigrator(xAlpaca);

    // deploy related contracts
    vm.startPrank(deployer, deployer);
    xAlpacaV2ReveneuDistirubor = deployxALPACAv2RevenueDistributor(alpaca);
    xAlpacaV2 = deployxALPACAv2(alpaca, address(xAlpacaV2ReveneuDistirubor), 0, feeTreasury, 0);

    address[] memory _whitelistCallers = new address[](1);
    _whitelistCallers[0] = address(xAlpacaV2);
    xAlpacaV2ReveneuDistirubor.setWhitelistedCallers(_whitelistCallers, true);
    vm.stopPrank();
  }
}
