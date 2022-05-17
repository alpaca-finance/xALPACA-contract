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
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY || "", process.env.LOCAL_PRIVATE_KEY_1 || ""].filter(o=> !!o),
    },
    mainnet: {
      url: process.env.BSC_MAINNET_RPC || "",
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY || ""].filter(o=> !!o),
    },
    fantom_testnet: {
      url: "https://rpc.testnet.fantom.network/",
      accounts: [process.env.FANTOM_TESTNET_PRIVATE_KEY || ""].filter(o=> !!o),
    },
    fantom_mainnet: {
      url: process.env.FTM_MAINNET_RPC || "",
      accounts: [process.env.FANTOM_MAINNET_PRIVATE_KEY || ""].filter(o=> !!o),
    },
    fantom_mainnetfork: {
      url: process.env.FTM_MAINNET_FORK_RPC || "",
      accounts: [process.env.FANTOM_MAINNET_PRIVATE_KEY || ""].filter(o=> !!o),
    },
    mainnetfork: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY || ""].filter(o=> !!o),
      timeout: 500000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts/8.10",
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
