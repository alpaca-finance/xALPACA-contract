// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { DSTest } from "./DSTest.sol";

import "../utils/Components.sol";

import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import { ProxyAdminLike } from "../interfaces/ProxyAdminLike.sol";

import { MockERC20 } from "../mocks/MockERC20.sol";

import { xALPACAv2RevenueDistributor } from "@xalpacav2/xALPACAv2RevenueDistributor/xALPACAv2RevenueDistributor.sol";
import { xALPACAv2Rewarder } from "@xalpacav2/xALPACAv2RevenueDistributor/xALPACAv2Rewarder.sol";
import { xALPACAv2 } from "@xalpacav2/xALPACAv2.sol";

import { BaseTest } from "./BaseTest.sol";

contract xALPACAV2_BaseTest is BaseTest {
  MockERC20 internal alpaca;
  MockERC20 internal rewardToken1;
  MockERC20 internal rewardToken2;
  MockERC20 internal mockToken1;

  xALPACAv2RevenueDistributor revenueDistributor;
  xALPACAv2 xAlpacaV2;

  address treasury;

  constructor() {
    // set block.timestamp be 100000
    vm.warp(100000);
    // deploy
    alpaca = deployMockErc20("ALPACA TOKEN", "ALPACA", 18);

    // mint token
    vm.deal(ALICE, 1000 ether);

    rewardToken1 = deployMockErc20("Reward Token 1", "RTOKEN1", 18);
    rewardToken2 = deployMockErc20("Reward Token 2", "RTOKEN2", 6);
    mockToken1 = deployMockErc20("Mock Token 1", "MTOKEN1", 18);

    revenueDistributor = deployxALPACAv2RevenueDistributor(address(alpaca));

    treasury = address(9999999);
    xAlpacaV2 = deployxALPACAv2(address(alpaca), address(revenueDistributor), 0, treasury, 0);

    address[] memory _whitelistCallers = new address[](1);
    _whitelistCallers[0] = address(xAlpacaV2);

    revenueDistributor.setWhitelistedCallers(_whitelistCallers, true);
  }
}
