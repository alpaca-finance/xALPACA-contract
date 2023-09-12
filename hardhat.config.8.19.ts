import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "hardhat-deploy";
import "solidity-coverage";

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: { mnemonic: "test test test test test test test test test test test junk" },
    },
    mainnet: {
      url: process.env.BSC_MAINNET_RPC || "",
      accounts: process.env.BSC_MAINNET_PRIVATE_KEY ? [process.env.BSC_MAINNET_PRIVATE_KEY] : [],
    },
    mainnetfork: {
      url: process.env.FORK_RPC || "",
      accounts: process.env.BSC_MAINNET_PRIVATE_KEY ? [process.env.BSC_MAINNET_PRIVATE_KEY] : [],
      timeout: 500000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts/8.19",
    tests: "./tests/unit",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "./typechain",
    target: "ethers-v5",
  },
  mocha: {
    timeout: 50000,
  },
};
