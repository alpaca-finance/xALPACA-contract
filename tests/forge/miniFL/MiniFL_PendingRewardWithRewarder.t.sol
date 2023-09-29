// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { MiniFL_BaseTest } from "./MiniFL_BaseTest.t.sol";

// interfaces
import { IMiniFL } from "../../../contracts/8.19/miniFL/interfaces/IMiniFL.sol";

contract MiniFL_PendingRewardWithRewarderTest is MiniFL_BaseTest {
  function setUp() public override {
    super.setUp();

    setupRewarder();

    prepareForHarvest();
  }

  // todo: rewrite this test
}
