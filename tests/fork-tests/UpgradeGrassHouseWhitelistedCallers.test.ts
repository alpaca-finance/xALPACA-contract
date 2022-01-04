import { ethers, waffle, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { GrassHouse__factory } from "../../typechain";
import { Timelock, Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { BigNumber, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as addresses from "../constants/addresses";
import * as deployHelper from "../helpers/deploy";
import * as timeHelper from "../helpers/time";
import { setTimestamp } from "../helpers/time";
import MainnetConfig from "../../.mainnet.json";
import { Config } from "../../deploy/interfaces/config";

chai.use(solidity);
const { expect } = chai;

describe("UpgradeGrassHouse - fork test", () => {
  let deployer: SignerWithAddress;

  // contracts
  let timelock: Timelock;

  async function fixture() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.DEPLOYER],
    });
    deployer = await ethers.getSigner(addresses.DEPLOYER);
    timelock = await Timelock__factory.connect(addresses.TIME_LOCK, deployer);
  }

  beforeEach(async () => {
    await waffle.loadFixture(fixture);
  });

  describe("UpgradeGrassHouse", () => {
    context("when try upgrade grasshouse contract", () => {
      it("should upgradeable", async () => {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const EXACT_ETA = block.timestamp + 3600 * 25; // assume execute in next 25 hours

        const config: Config = MainnetConfig;
        type UpgradeGrasshouse = {
          grasshouseAddress: string;
          preparedNewGrassHouse: string;
        };
        const upgradeList: UpgradeGrasshouse[] = [];

        for (const grasshouse of config.GrassHouses) {
          console.log(`============`);
          console.log(">> Prepare upgrade & deploy");
          const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
          const preparedNewGrassHouse = await upgrades.prepareUpgrade(grasshouse.address, GrassHouse);
          upgradeList.push({ grasshouseAddress: grasshouse.address, preparedNewGrassHouse });

          console.log(`>> Implementation address: ${preparedNewGrassHouse}`);
          console.log("✅ Done");

          console.log(`>> Queue tx on Timelock to upgrade the implementation`);
          await timelock.queueTransaction(
            config.ProxyAdmin,
            "0",
            "upgrade(address,address)",
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [grasshouse.address, preparedNewGrassHouse]),
            EXACT_ETA
          );
          console.log("✅ Done");

          console.log(`>> Generate executeTransaction:`);
          console.log(
            `await timelock.executeTransaction('${config.ProxyAdmin}', '0', 'upgrade(address,address)', ethers.utils.defaultAbiCoder.encode(['address','address'], ['${grasshouse.address}','${preparedNewGrassHouse}']), ${EXACT_ETA})`
          );
          console.log("✅ Done");
        }
        // move timstamp pass timelock
        setTimestamp(BigNumber.from(EXACT_ETA));

        for (const item of upgradeList) {
          console.log("execute upgrade");
          await timelock.executeTransaction(
            config.ProxyAdmin,
            "0",
            "upgrade(address,address)",
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address"],
              [item.grasshouseAddress, item.preparedNewGrassHouse]
            ),
            EXACT_ETA
          );
          console.log("✅ Done");
        }
      });
    });
  });
});
