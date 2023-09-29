// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { DSTest } from "./DSTest.sol";

import "../utils/Components.sol";

import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import { ProxyAdminLike } from "../interfaces/ProxyAdminLike.sol";

import { MockERC20 } from "../mocks/MockERC20.sol";

import { MiniFL } from "@xalpacav2/miniFL/MiniFL.sol";
import { Rewarder } from "@xalpacav2/miniFL/Rewarder.sol";
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
  MockERC20 internal weth;
  MockERC20 internal usdc;

  ProxyAdminLike internal proxyAdmin;

  MiniFL internal miniFL;
  xALPACAv2 internal xALPACA;

  address internal treasury;
  uint256 constant maxAlpacaPerSecond = 1000 ether;

  constructor() {
    // set block.timestamp be 100000
    vm.warp(100000);
    // deploy
    alpaca = deployMockErc20("ALPACA TOKEN", "ALPACA", 18);

    // mint token
    vm.deal(ALICE, 1000 ether);

    // miniFL
    proxyAdmin = _setupProxyAdmin();

    vm.label(DEPLOYER, "DEPLOYER");
    vm.label(ALICE, "ALICE");
    vm.label(BOB, "BOB");
    vm.label(CAT, "CAT");
    vm.label(EVE, "EVE");

    rewardToken1 = deployMockErc20("Reward Token 1", "RTOKEN1", 18);
    rewardToken2 = deployMockErc20("Reward Token 2", "RTOKEN2", 6);
    mockToken1 = deployMockErc20("Mock Token 1", "MTOKEN1", 18);
    weth = deployMockErc20("Wrapped Ethereum", "WETH", 18);
    usdc = deployMockErc20("USD COIN", "USDC", 6);

    uint256 wethDecimal = weth.decimals();
    uint256 usdcDecimal = usdc.decimals();

    weth.mint(ALICE, normalizeEther(1000 ether, wethDecimal));
    alpaca.mint(ALICE, normalizeEther(1000 ether, wethDecimal));
    usdc.mint(ALICE, normalizeEther(1000 ether, usdcDecimal));

    weth.mint(EVE, normalizeEther(1000 ether, wethDecimal));
    alpaca.mint(EVE, normalizeEther(1000 ether, wethDecimal));
    usdc.mint(EVE, normalizeEther(1000 ether, usdcDecimal));

    weth.mint(BOB, normalizeEther(1000 ether, wethDecimal));
    alpaca.mint(BOB, normalizeEther(1000 ether, wethDecimal));
    usdc.mint(BOB, normalizeEther(1000 ether, usdcDecimal));

    miniFL = deployMiniFL(address(alpaca));

    treasury = address(9999999);
    xALPACA = deployxALPACAv2(address(alpaca), 0, treasury, 0);
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
    uint256 _delayUnlockTime,
    address _feeTreasury,
    uint256 _earlyWithdrawFeeBpsPerDay
  ) internal returns (xALPACAv2) {
    bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/xALPACAv2.sol/xALPACAv2.json"));
    bytes memory _initializer = abi.encodeWithSelector(
      bytes4(keccak256("initialize(address,uint256,address,uint256)")),
      _token,
      _delayUnlockTime,
      _feeTreasury,
      _earlyWithdrawFeeBpsPerDay
    );
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return xALPACAv2(_proxy);
  }

  function deployMiniFL(address _rewardToken) internal returns (MiniFL) {
    bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/MiniFL.sol/MiniFL.json"));
    bytes memory _initializer = abi.encodeWithSelector(bytes4(keccak256("initialize(address)")), _rewardToken);
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return MiniFL(_proxy);
  }

  function deployRewarder(
    string memory _name,
    address _miniFL,
    address _rewardToken,
    uint256 _maxRewardPerSecond
  ) internal returns (Rewarder) {
    bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/Rewarder.sol/Rewarder.json"));
    bytes memory _initializer = abi.encodeWithSelector(
      bytes4(keccak256("initialize(string,address,address,uint256)")),
      _name,
      _miniFL,
      _rewardToken,
      _maxRewardPerSecond
    );
    address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    return Rewarder(_proxy);
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
