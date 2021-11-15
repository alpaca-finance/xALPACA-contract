import { ethers, waffle, network, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  ProxyToken,
  ProxyToken__factory,
  IFairLaunch__factory,
  Timelock,
  Timelock__factory,
  IFairLaunch,
  GrassHouse,
  AlpacaFeeder,
  XALPACA,
  BEP20,
  BEP20__factory,
  XALPACA__factory,
  GrassHouse__factory,
  AlpacaFeeder__factory,
} from "../typechain";
import * as timeHelpers from "./helpers/time";
import { BigNumber, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
const { expect } = chai;

// contract's addresses
const TIME_LOCK = "0x2D5408f2287BF9F9B05404794459a846651D0a59";
const FAIR_LAUNCH = "0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F";
const DEPLOYER = "0xC44f82b07Ab3E691F826951a6E335E1bC1bB0B51";
const SHIELD = "0x1963f84395c8cf464e5483de7f2f434c3f1b4656";
const ALPACA = "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F";
const BNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
// const ProxyAdmin = "0x5379F32C8D5F663EACb61eeF63F722950294f452";

// constants
const RPC_URL = "http://localhost:8545";
const HOUR = 3600; // HOUR in seconds
const DAY = 24 * HOUR; // DAY in seconds: 86400
// async function main() {
//   if (network.name !== "mainnetfork") throw new Error("not mainnet fork");
//   const eta = 1636774728;
//   await network.provider.request({
//     method: "hardhat_impersonateAccount",
//     params: [DEPLOYER],
//   });
//   const deployerMain = await ethers.getSigner(DEPLOYER);
//   const timelockAsDeployer = Timelock__factory.connect(TIME_LOCK, deployerMain);
//   const fairLaunch = IFairLaunch__factory.connect(FAIR_LAUNCH, deployerMain);
//   const len1 = await fairLaunch.poolLength();

//   console.log(`>> Deploying proxyToken`);
//   const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", deployerMain)) as ProxyToken__factory;
//   const proxyToken = (await upgrades.deployProxy(PROXY_TOKEN, [`proxyToken`, `proxyToken`, TIME_LOCK])) as ProxyToken;
//   await proxyToken.deployed();
//   console.log(`>> Deployed at ${proxyToken.address}`);

//   const queue = await timelockAsDeployer.queueTransaction(
//     SHIELD,
//     "0",
//     "addPool(uint256,address,bool)",
//     ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
//     eta
//   );
//   console.log(`>> Queue success ${queue.hash}`);
//   await timeHelpers.setTimestamp(ethers.BigNumber.from(eta));
//   const exe = await timelockAsDeployer.executeTransaction(
//     SHIELD,
//     "0",
//     "addPool(uint256,address,bool)",
//     ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
//     eta
//   );
//   console.log(`>> Exe success ${queue.hash}`);
//   const len2 = await fairLaunch.poolLength();

//   console.log(len1, len2);
// }

const currentTimestamp = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

describe("AlpacaFeeder - Integration test", () => {
  let deployer: SignerWithAddress;
  let bot: Signer;
  let lyf: Signer;

  // setting
  let poolId: BigNumber;

  let bnb: BEP20;
  let alpaca: BEP20;

  let proxyToken: ProxyToken;

  // contracts
  let xALPACA: XALPACA;
  let fairlaunch: IFairLaunch;
  let timelock: Timelock;
  let alpacaFeeder: AlpacaFeeder;
  let grassHouse: GrassHouse;

  // connected
  let alpacaFeederAsDeployer: AlpacaFeeder;

  async function fixture() {
    const [bot, lyf] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEPLOYER],
    });
    deployer = await ethers.getSigner(DEPLOYER);

    // connect alpaca
    alpaca = await BEP20__factory.connect(ALPACA, deployer);
    // connect timelock
    timelock = await Timelock__factory.connect(TIME_LOCK, deployer);
    // connect fairlaunch
    fairlaunch = await IFairLaunch__factory.connect(FAIR_LAUNCH, deployer);

    console.log("Deploy xAlpaca");
    const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
    xALPACA = (await upgrades.deployProxy(XALPACA, [alpaca.address])) as XALPACA;
    await xALPACA.deployed();

    console.log("Deploy PROXY Token");
    const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", deployer)) as ProxyToken__factory;
    const proxyTokenDeployer = (await upgrades.deployProxy(PROXY_TOKEN, [
      `proxyToken`,
      `proxyToken`,
      TIME_LOCK,
    ])) as ProxyToken;
    proxyToken = await proxyTokenDeployer.deployed();

    console.log("Deploy Grasshouse");
    const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    const grassHouseDeployer = (await upgrades.deployProxy(GrassHouse, [
      xALPACA.address,
      await timeHelpers.latestTimestamp(),
      alpaca.address,
      deployer.address,
    ])) as GrassHouse;
    grassHouse = await grassHouseDeployer.deployed();

    poolId = await fairlaunch.poolLength();
    const executeTime = (await currentTimestamp()) + DAY + HOUR;
    await timelock.queueTransaction(
      SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
      executeTime
    );

    await timeHelpers.setTimestamp(ethers.BigNumber.from(executeTime));
    await timelock.executeTransaction(
      SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [100, proxyToken.address, false]),
      executeTime
    );

    console.log("Deploy AlpacaFeeder");
    const ALCAPAFEEDER = (await ethers.getContractFactory("AlpacaFeeder", deployer)) as AlpacaFeeder__factory;
    const alpacaFeederDeployer = (await upgrades.deployProxy(ALCAPAFEEDER, [
      alpaca.address,
      proxyToken.address,
      fairlaunch.address,
      poolId,
      grassHouse.address,
    ])) as AlpacaFeeder;
    alpacaFeeder = await alpacaFeederDeployer.deployed();
    await proxyToken.setOkHolders([alpacaFeeder.address, fairlaunch.address], true);
    await proxyToken.transferOwnership(alpacaFeeder.address);
  }

  beforeEach(async () => {
    // await network.provider.request({
    //   method: "hardhat_reset",
    //   params: [
    //     {
    //       forking: {
    //         jsonRpcUrl:
    //           "https://weathered-billowing-resonance.bsc.quiknode.pro/f98a121ea42a5f4b6b3a7ef736880f1db9018146/",
    //       },
    //     },
    //   ],
    // });

    await waffle.loadFixture(fixture);
  });

  context("when harvest from fairlaunch", () => {
    it("should work", async () => {
      const balance = await alpaca.balanceOf(alpacaFeeder.address);
      await expect(alpacaFeeder.fairLaunchDeposit()).to.be.emit(alpacaFeeder, "LogFairLaunchDeposit");
      // advance block for 1 week
      const targetTime = (await currentTimestamp()) + 7 * DAY;
      await timeHelpers.setTimestamp(ethers.BigNumber.from(targetTime));
      await expect(alpacaFeeder.fairLaunchHarvest()).to.be.emit(alpacaFeeder, "LogFairLaunchHarvest");

      expect(await alpaca.balanceOf(alpacaFeeder.address)).to.be.greaterThan(balance);
    });
  });

  context("when harvest reward from fairlaunch and feed to grasshouse", () => {});

  context("when receive alpaca from LYF (play as alice)", () => {});
});

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });

// test scenario on feeder
// try feed to grasshouse by bot
// - assert harvest from fairlaunch before feed
// - correct feed amount
// - check emit event Harvest / Feed
// - grasshouse balance should be increased
// - if worker give alpaca feed amount should be increased
// - confirmed we can receive alpaca from worker or someone
// - try test feed in case of fairlaunch valid / not valid
