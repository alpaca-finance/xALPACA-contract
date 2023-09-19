// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import {StdStorage, VM} from "./Components.sol";

abstract contract CommonBase {
    address internal constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    uint256 internal constant UINT256_MAX =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    StdStorage internal stdstore;
    VM internal constant vm = VM(VM_ADDRESS);
}
