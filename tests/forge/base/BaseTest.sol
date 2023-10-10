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

contract BaseTest is DSTest, StdUtils, StdAssertions, StdCheats {
  address internal constant DEPLOYER = address(0x01);
  address internal constant ALICE = address(0x88);
  address internal constant BOB = address(0x168);
  address internal constant CAT = address(0x99);
  address internal constant EVE = address(0x55);

  VM internal constant vm = VM(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

  MockERC20 internal alpaca;
  MockERC20 internal rewardToken1;
  MockERC20 internal rewardToken2;
  MockERC20 internal mockToken1;

  ProxyAdminLike internal proxyAdmin;

  xALPACAv2RevenueDistributor internal revenueDistributor;
  xALPACAv2 internal xAlpacaV2;

  address internal treasury;
  uint256 constant maxAlpacaPerSecond = 1000 ether;

  constructor() {
    // set block.timestamp be 100000
    vm.warp(100000);
    // deploy
    alpaca = deployMockErc20("ALPACA TOKEN", "ALPACA", 18);

    // mint token
    vm.deal(ALICE, 1000 ether);

    // xALPACAv2RevenueDistributor
    proxyAdmin = _setupProxyAdmin();

    vm.label(DEPLOYER, "DEPLOYER");
    vm.label(ALICE, "ALICE");
    vm.label(BOB, "BOB");
    vm.label(CAT, "CAT");
    vm.label(EVE, "EVE");

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

  function deployMockErc20(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal returns (MockERC20 mockERC20) {
    mockERC20 = new MockERC20(name, symbol, decimals);
    vm.label(address(mockERC20), symbol);
  }

  function deployxALPACAv2(
    address _token,
    address _revenueDistributor,
    uint256 _delayUnlockTime,
    address _feeTreasury,
    uint256 _earlyWithdrawFeeBpsPerDay
  ) internal returns (xALPACAv2) {
    bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/xALPACAv2.sol/xALPACAv2.json"));
    bytes memory _initializer = abi.encodeWithSelector(
      bytes4(keccak256("initialize(address,address,uint256,address,uint256)")),
      _token,
      _revenueDistributor,
      _delayUnlockTime,
      _feeTreasury,
      _earlyWithdrawFeeBpsPerDay
    );
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return xALPACAv2(_proxy);
  }

  function deployxALPACAv2RevenueDistributor(address _rewardToken) internal returns (xALPACAv2RevenueDistributor) {
    bytes memory _logicBytecode = abi.encodePacked(
      vm.getCode("./out/xALPACAv2RevenueDistributor.sol/xALPACAv2RevenueDistributor.json")
    );
    bytes memory _initializer = abi.encodeWithSelector(bytes4(keccak256("initialize(address)")), _rewardToken);
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return xALPACAv2RevenueDistributor(_proxy);
  }

  function deployRewarder(
    string memory _name,
    address _xALPACAv2RevenueDistributor,
    address _rewardToken
  ) internal returns (xALPACAv2Rewarder) {
    bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/xALPACAv2Rewarder.sol/xALPACAv2Rewarder.json"));
    bytes memory _initializer = abi.encodeWithSelector(
      bytes4(keccak256("initialize(string,address,address)")),
      _name,
      _xALPACAv2RevenueDistributor,
      _rewardToken
    );
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return xALPACAv2Rewarder(_proxy);
  }

  function _setupUpgradeable(bytes memory _logicBytecode, bytes memory _initializer) internal returns (address) {
    bytes memory _proxyBytecode = abi.encodePacked(
      vm.getCode("./out/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json")
    );

    address _logic;
    assembly {
      _logic := create(0, add(_logicBytecode, 0x20), mload(_logicBytecode))
    }

    _proxyBytecode = abi.encodePacked(_proxyBytecode, abi.encode(_logic, address(proxyAdmin), _initializer));

    address _proxy;
    assembly {
      _proxy := create(0, add(_proxyBytecode, 0x20), mload(_proxyBytecode))
      if iszero(extcodesize(_proxy)) {
        revert(0, 0)
      }
    }

    return _proxy;
  }

  function _setupProxyAdmin() internal returns (ProxyAdminLike) {
    bytes memory _bytecode = abi.encodePacked(vm.getCode("./out/ProxyAdmin.sol/ProxyAdmin.json"));
    address _address;
    assembly {
      _address := create(0, add(_bytecode, 0x20), mload(_bytecode))
    }
    return ProxyAdminLike(address(_address));
  }

  function normalizeEther(uint256 _ether, uint256 _decimal) internal pure returns (uint256 _normalizedEther) {
    _normalizedEther = _ether / 10**(18 - _decimal);
  }
}
