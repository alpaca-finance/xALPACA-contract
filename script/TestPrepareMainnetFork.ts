import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BEP20,
  BEP20__factory,
  XALPACA__factory,
  GrassHouse,
  GrassHouse__factory,
  ProxyToken,
  AlpacaFeeder,
} from "../typechain";
import * as timeHelpers from "../tests/helpers/time";
import * as addresses from "../tests/constants/addresses";
import {
  Timelock__factory,
  FairLaunch__factory,
  FairLaunch,
  AlpacaToken,
  AlpacaToken__factory,
  CakeMaxiWorker02,
  PancakeswapV2Worker02,
  CakeMaxiWorker02__factory,
  PancakeswapV2Worker02__factory,
} from "@alpaca-finance/alpaca-contract/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TimelockHelper } from "../tests/helpers/timelock";
import * as deployHelper from "../tests/helpers/deploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Token
  let DTOKEN: BEP20;
  let BTOKEN: BEP20;
  let alpacaToken: AlpacaToken;
  let proxyToken: ProxyToken;

  // Contract
  let fairlaunch: FairLaunch;
  let timelockHelper: TimelockHelper;
  let grassHouseDTOKEN: GrassHouse;
  let grassHouseAlpaca: GrassHouse;
  let alpacaFeeder: AlpacaFeeder;

  // Signer
  let deployer: SignerWithAddress;

  let poolId: BigNumber;

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.DEPLOYER],
  });
  deployer = await ethers.getSigner(addresses.DEPLOYER);

  // Deploy DTOKEN, BTOKEN, ALPACATOKEN
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
  DTOKEN = await BEP20.deploy("DTOKEN", "DTOKEN");
  await DTOKEN.mint(deployer.address, ethers.utils.parseEther("888888888888888"));

  BTOKEN = await BEP20.deploy("BTOKEN", "BTOKEN");
  await BTOKEN.mint(deployer.address, ethers.utils.parseEther("888888888888888"));

  alpacaToken = await AlpacaToken__factory.connect(addresses.ALPACA, deployer);

  // Deploy XAlpaca
  const XALPACA = (await ethers.getContractFactory("xALPACA", deployer)) as XALPACA__factory;
  const xAlpaca = await XALPACA.deploy();

  // Deploy GrassHouse
  const GrassHouse = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
  grassHouseDTOKEN = (await upgrades.deployProxy(GrassHouse, [
    xAlpaca.address,
    await timeHelpers.latestTimestamp(),
    DTOKEN.address,
    deployer.address,
  ])) as GrassHouse;
  await grassHouseDTOKEN.deployed();

  grassHouseAlpaca = (await upgrades.deployProxy(GrassHouse, [
    xAlpaca.address,
    await timeHelpers.latestTimestamp(),
    addresses.ALPACA,
    deployer.address,
  ])) as GrassHouse;
  await grassHouseDTOKEN.deployed();

  // feed token to feeder
  await DTOKEN.approve(grassHouseDTOKEN.address, ethers.constants.MaxUint256);
  await alpacaToken.approve(grassHouseDTOKEN.address, ethers.constants.MaxUint256);
  await grassHouseDTOKEN.feed(ethers.utils.parseEther("100"));
  await grassHouseAlpaca.feed(ethers.utils.parseEther("100"));

  const timelock = await Timelock__factory.connect(addresses.TIME_LOCK, deployer);
  fairlaunch = await FairLaunch__factory.connect(addresses.FAIR_LAUNCH, deployer);
  timelockHelper = new TimelockHelper(timelock, fairlaunch);
  poolId = await fairlaunch.poolLength();

  // Deploy proxy token
  proxyToken = await deployHelper.deployProxyToken(deployer);
  console.log("proxyToken address: ", proxyToken.address);

  // Deploy alpacaFeeder
  alpacaFeeder = await deployHelper.deployAlpacaFeeder(deployer, proxyToken.address, poolId, proxyToken.address);
  console.log("alpacaFeeder address: ", alpacaFeeder.address);

  const poolIdAfterAdded = await timelockHelper.addFairLaunchPool(100, proxyToken.address, false);
  console.log("poolId proxyToken: ", ethers.utils.formatEther(poolIdAfterAdded));

  await proxyToken.setOkHolders([alpacaFeeder.address, fairlaunch.address], true);
  await proxyToken.transferOwnership(alpacaFeeder.address);

  // Prepare Workers
  // Set execute time
  const executeTime = (await timeHelpers.latestTimestamp()).toNumber();

  // Set reinvest whitelist
  // CakeMaxiWorker
  await timelock.queueTransaction(
    addresses.CAKEMAXI_WORKER,
    "0",
    "setReinvestorOk(address[],bool)",
    ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
    executeTime
  );
  // PancakeSwapWorker
  await timelock.queueTransaction(
    addresses.PCS_WORKER,
    "0",
    "setReinvestorOk(address[],bool)",
    ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
    executeTime
  );

  // Set beneficial vault for worker
  // CakeMaxiWorker
  await timelock.queueTransaction(
    addresses.CAKEMAXI_WORKER,
    "0",
    "setBeneficialVaultConfig(uint256,address,address[])",
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "address[]"],
      [100, alpacaFeeder.address, [addresses.CAKE, addresses.WBNB, addresses.ALPACA]]
    ),
    executeTime
  );
  // PancakeSwapWorker
  await timelock.queueTransaction(
    addresses.PCS_WORKER,
    "0",
    "setBeneficialVaultConfig(uint256,address,address[])",
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "address[]"],
      [100, alpacaFeeder.address, [addresses.CAKE, addresses.WBNB, addresses.ALPACA]]
    ),
    executeTime
  );

  // Advance time block
  await timeHelpers.increaseTimestamp(timeHelpers.duration.days(ethers.BigNumber.from(2)));

  // Execute set beneficial vault.
  // CakeMaxi Worker
  await timelock.executeTransaction(
    addresses.CAKEMAXI_WORKER,
    "0",
    "setBeneficialVaultConfig(uint256,address,address[])",
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "address[]"],
      [100, alpacaFeeder.address, [addresses.CAKE, addresses.WBNB, addresses.ALPACA]]
    ),
    executeTime
  );
  // PancakeSwapWorker
  await timelock.executeTransaction(
    addresses.PCS_WORKER,
    "0",
    "setBeneficialVaultConfig(uint256,address,address[])",
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "address[]"],
      [100, alpacaFeeder.address, [addresses.CAKE, addresses.WBNB, addresses.ALPACA]]
    ),
    executeTime
  );

  // Execute set reinvest whitelist
  // CakeMaxiWorker
  await timelock.executeTransaction(
    addresses.CAKEMAXI_WORKER,
    "0",
    "setReinvestorOk(address[],bool)",
    ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
    executeTime
  );
  // PancakeSwapWorker
  await timelock.executeTransaction(
    addresses.PCS_WORKER,
    "0",
    "setReinvestorOk(address[],bool)",
    ethers.utils.defaultAbiCoder.encode(["address[]", "bool"], [[deployer.address], true]),
    executeTime
  );

  xAlpaca.initialize(addresses.ALPACA);
  console.log("DTOKEN address: ", DTOKEN.address);
  console.log("xAlpaca address: ", xAlpaca.address);
  console.log("GrassHouse address: ", grassHouseDTOKEN.address);
  console.log("AlpacaFeeder address: ", alpacaFeeder.address);
  console.log("✅ Done");
};

export default func;
func.tags = ["TestPrepareMainnetFork"];
