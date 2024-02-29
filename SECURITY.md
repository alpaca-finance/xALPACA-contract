# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is ac

{
  "name": "hardhat-boilerplate",
  "version": "1.0.0",
  "description": "A boilerplate repository to get you started with Hardhat and Ethereum development",
  "scripts": {
    "test": "hardhat test"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/NomicFoundation/hardhat-boilerplate.git"
  },
  "author": "Nomic Foundation",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/NomicFoundation/hardhat-boilerplate/issues"
  },
  "homepage": "https://github.com/NomicFoundation/hardhat-boilerplate#readme",
  "devDependencies": {
    "@ethersproject/abi": "^5.7.0",
    "@ethersproject/providers": "^5.7.2",
    "@nomicfoundation/hardhat-chai-matchers": "^1.0.5",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.7",
    "@nomicfoundation/hardhat-toolbox": "^2.0.0",
    "@nomiclabs/hardhat-ethers": "^2.2.1",
    "@nomiclabs/hardhat-etherscan": "^3.1.4",
    "chai": "^4.3.7",
    "ethers": "^5.7.2",
    "hardhat": "^2.12.5",
    "hardhat-gas-reporter": "^1.0.9",
    "solidity-coverage": "^0.8.2"
  }
}
