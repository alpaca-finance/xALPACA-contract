// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {DSTest} from "./DSTest.sol";

import "../utils/Components.sol";
import {ProxyAdminLike} from "../interfaces/ProxyAdminLike.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract BaseTest is DSTest, StdUtils, StdAssertions, StdCheats {
    address internal constant DEPLOYER = address(0x01);
    address internal constant ALICE = address(0x88);
    address internal constant BOB = address(0x168);
    address internal constant CAT = address(0x99);
    address internal constant EVE = address(0x55);

    VM internal constant vm = VM(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    MockERC20 internal alpaca;

    ProxyAdminLike internal proxyAdmin;

    // MiniFL internal miniFL;
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

        // miniFL = deployMiniFL(address(alpaca), maxAlpacaPerSecond);
    }

    function deployMockErc20(string memory name, string memory symbol, uint8 decimals)
        internal
        returns (MockERC20 mockERC20)
    {
        mockERC20 = new MockERC20(name, symbol, decimals);
        vm.label(address(mockERC20), symbol);
    }

    // function deployMiniFL(address _rewardToken, uint256 _rewardPerSec) internal returns (MiniFL) {
    //   bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/MiniFL.sol/MiniFL.json"));
    //   bytes memory _initializer = abi.encodeWithSelector(
    //     bytes4(keccak256("initialize(address,uint256)")),
    //     _rewardToken,
    //     _rewardPerSec
    //   );
    //   address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    //   return MiniFL(_proxy);
    // }

    // function deployRewarder(
    //   string memory _name,
    //   address _miniFL,
    //   address _rewardToken,
    //   uint256 _maxRewardPerSecond
    // ) internal returns (Rewarder) {
    //   bytes memory _logicBytecode = abi.encodePacked(vm.getCode("./out/Rewarder.sol/Rewarder.json"));
    //   bytes memory _initializer = abi.encodeWithSelector(
    //     bytes4(keccak256("initialize(string,address,address,uint256)")),
    //     _name,
    //     _miniFL,
    //     _rewardToken,
    //     _maxRewardPerSecond
    //   );
    //   address _proxy = _setupUpgradeable(_logicBytecode, _initializer);
    //   return Rewarder(_proxy);
    // }

    function _setupUpgradeable(bytes memory _logicBytecode, bytes memory _initializer) internal returns (address) {
        bytes memory _proxyBytecode =
            abi.encodePacked(vm.getCode("./out/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json"));

        address _logic;
        assembly {
            _logic := create(0, add(_logicBytecode, 0x20), mload(_logicBytecode))
        }

        _proxyBytecode = abi.encodePacked(_proxyBytecode, abi.encode(_logic, address(proxyAdmin), _initializer));

        address _proxy;
        assembly {
            _proxy := create(0, add(_proxyBytecode, 0x20), mload(_proxyBytecode))
            if iszero(extcodesize(_proxy)) { revert(0, 0) }
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
        _normalizedEther = _ether / 10 ** (18 - _decimal);
    }
}
