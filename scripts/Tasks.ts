import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task, types } from "hardhat/config";
import * as addresses from "../tests/constants/addresses";
import { parseEther } from "@ethersproject/units";
import {
  BEP20,
  BEP20__factory,
  XALPACA__factory,
  GrassHouse,
  GrassHouse__factory,
  ProxyToken,
  AlpacaFeeder,
  XALPACA,
  AlpacaFeeder__factory,
} from "../typechain";
import { AlpacaToken__factory } from "@alpaca-finance/alpaca-contract/typechain";

/*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the task
  */
const XALPACA_ADDRESS = "0x9E7084d7894C01D2b1cA3793385E986622506e4D";
const FEEDER_ADDRESS = "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F";
const ALPACA_GRASSHOUSE_ADDRESS = "";

task("advance-time", "Advance timestamp and blocks")
  .addOptionalParam("years", "Years to be advanced", 0, types.int)
  .addOptionalParam("weeks", "Weeks to be advanced", 0, types.int)
  .addOptionalParam("days", "Days to be advanced", 0, types.int)
  .addOptionalParam("hours", "Hours to be advanced", 0, types.int)
  .setAction(async ({ years, weeks, days, hours }, { ethers }) => {
    const SEC_PER_BLOCK = 3600;
    const HOUR = ethers.BigNumber.from(3600);
    const DAY = ethers.BigNumber.from(86400);
    const WEEK = DAY.mul(7);
    const YEAR = DAY.mul(365);
    const yearsInSec = YEAR.mul(years);
    const weeksInSec = WEEK.mul(weeks);
    const daysInSec = DAY.mul(days);
    const hoursInSec = HOUR.mul(hours);
    const durationInSec = yearsInSec.add(weeksInSec).add(daysInSec).add(hoursInSec);
    await ethers.provider.send("evm_increaseTime", [durationInSec.toNumber()]);

    const blockBefore = await ethers.provider.getBlock("latest");
    const blockToAdvance = durationInSec.div(SEC_PER_BLOCK).toNumber();
    console.log("current block(Before advance): ", blockBefore.number);
    console.log("current timestamp(Before advance): ", blockBefore.timestamp);
    for (let i = 0; i < blockToAdvance; i++) {
      await ethers.provider.send("evm_mine", []);
      i++;
    }

    const blockAfter = await ethers.provider.getBlock("latest");
    console.log("current block(After advance): ", blockAfter.number);
    console.log("current timestamp(After advance): ", blockAfter.timestamp);
  });

task("set-timestamp-startweek", "set timestamp to start week cursor").setAction(async ({ ethers }) => {
  const DAY = ethers.BigNumber.from(86400);
  const WEEK = DAY.mul(7);

  const blockBefore = await ethers.provider.getBlock("latest");
  const latestTimestamp = ethers.BigNumber.from(blockBefore.timestamp);
  await ethers.provider.send("evm_mine", [latestTimestamp.div(WEEK).add(1).mul(WEEK).toNumber()]);
  console.log("current timestamp(Before advance): ", blockBefore.timestamp);

  const blockAfter = await ethers.provider.getBlock("latest");
  console.log("current timestamp(After advance): ", blockAfter.timestamp);
});

task("checkpoint", "set can check point token")
  .addParam("grasshouseaddress", "address of grassHouse to be called checkpoint", "", types.string)
  .setAction(async ({ grasshouseaddress }, { ethers }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const deployer = await SignerWithAddress.create(signer);

    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouseaddress, deployer);
    await grassHouseAsDeployer.checkpointToken();

    console.log("✅ Done checkpoint");
  });

task("checkpoint-total-supply", "call checkpointTotalSupply")
  .addParam("grasshouseaddress", "address of grassHouse to be called checkpoint", "", types.string)
  .setAction(async ({ grasshouseaddress }, { ethers }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const deployer = await SignerWithAddress.create(signer);

    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouseaddress, deployer);
    await grassHouseAsDeployer.checkpointTotalSupply();

    console.log("✅ Done checkpointTotalSupply");
  });

task("enable-checkpoint", "Enable checkpointToken to be call by anyone")
  .addParam("grasshouseaddress", "address of grassHouse to be called checkpoint", "", types.string)
  .setAction(async ({ grasshouseaddress }, { ethers }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const deployer = await SignerWithAddress.create(signer);

    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouseaddress, deployer);
    await grassHouseAsDeployer.setCanCheckpointToken(true);

    console.log("✅ Done enable checkpoint");
  });

task("feed-grasshouse", "feed XToken to grassHouse")
  .addParam("grasshouseaddress", "grassHouse address to be feed", "", types.string)
  .addParam("grasshousetokenaddress", "address token of grassHouse", "", types.string)
  .addParam("amount", "amount of XToken to be feed", "", types.string)
  .setAction(async ({ grasshouseaddress, grasshousetokenaddress, amount }, { ethers }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const deployer = await SignerWithAddress.create(signer);

    const grassHouseTokenAsDeployer = BEP20__factory.connect(grasshousetokenaddress, deployer);
    const grassHouseAsDeployer = GrassHouse__factory.connect(grasshouseaddress, deployer);

    await grassHouseTokenAsDeployer.approve(grasshouseaddress, parseEther(amount));
    await grassHouseAsDeployer.feed(parseEther(amount));

    console.log(
      "balance of XToken in grassHouse: ",
      await grassHouseTokenAsDeployer.balanceOf(grassHouseAsDeployer.address)
    );
    console.log(`✅ Done feed ${amount} to grassHouse ${grassHouseAsDeployer.address}`);
  });

task("deploy-grasshouse", "deploy grassHouseXToken")
  .addParam("tokenname", "token name", "XToken", types.string)
  .setAction(async ({ tokenname }, { ethers, upgrades }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const deployer = await SignerWithAddress.create(signer);

    const block = await ethers.provider.getBlock("latest");
    const latestTimestamp = ethers.BigNumber.from(block.timestamp);

    const BEP20 = (await ethers.getContractFactory("BEP20", deployer)) as BEP20__factory;
    const XToken = await BEP20.deploy(tokenname, tokenname);
    await XToken.mint(await deployer.getAddress(), ethers.utils.parseEther("888888888888888"));

    // Deploy GrassHouse
    const grassHouseAsDeployer = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    const grassHouseXToken = (await upgrades.deployProxy(grassHouseAsDeployer, [
      XALPACA_ADDRESS,
      latestTimestamp,
      XToken.address,
      await deployer.getAddress(),
    ])) as GrassHouse;
    await grassHouseXToken.deployed();

    console.log(`${tokenname}: `, XToken.address);
    console.log(`✅ Done deploy ${tokenname}GrassHouse: `, grassHouseXToken.address);
  });

task("deploy-grasshouse-dynamic-token", "deploy grassHouse with already exist token on mainnet")
  .addParam("ownertokenaddress", "address of the owner of the token", "", types.string)
  .addParam("tokenaddress", "address of token", "", types.string)
  .setAction(async ({ ownertokenaddress, tokenaddress }, { ethers, upgrades }) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER, ownertokenaddress]);
    const signer = provider.getSigner(addresses.DEPLOYER);
    const signer1 = provider.getSigner(ownertokenaddress);
    const deployer = await SignerWithAddress.create(signer);
    const tokenOwner = await SignerWithAddress.create(signer1);

    const block = await ethers.provider.getBlock("latest");
    const latestTimestamp = ethers.BigNumber.from(block.timestamp);

    const XToken = await BEP20__factory.connect(tokenaddress, tokenOwner);
    await XToken.mint(await deployer.getAddress(), ethers.utils.parseEther("888888888888888"));

    // Deploy GrassHouse
    const grassHouseAsDeployer = (await ethers.getContractFactory("GrassHouse", deployer)) as GrassHouse__factory;
    const grassHouseXToken = (await upgrades.deployProxy(grassHouseAsDeployer, [
      XALPACA_ADDRESS,
      latestTimestamp,
      XToken.address,
      await deployer.getAddress(),
    ])) as GrassHouse;
    await grassHouseXToken.deployed();

    console.log(`XToken.address`);
    console.log(`✅ Done deploy GrassHouse with already exist token: `, grassHouseXToken.address);
  });

task("feed-alpaca-grasshouse", "feed alpaca to grassHouse").setAction(async ({ ethers }) => {
  const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
  await provider.send("hardhat_impersonateAccount", [addresses.DEPLOYER]);
  const signer = provider.getSigner(addresses.DEPLOYER);
  const deployer = await SignerWithAddress.create(signer);

  const alpacaTokenAsDeployer = AlpacaToken__factory.connect(addresses.ALPACA, deployer);
  const alpacaFeederAsDeployer = AlpacaFeeder__factory.connect(FEEDER_ADDRESS, deployer);

  console.log(
    `Alpaca amount at AlpacaGrassHouse(Before feed)`,
    await alpacaTokenAsDeployer.balanceOf(ALPACA_GRASSHOUSE_ADDRESS)
  );
  await alpacaTokenAsDeployer.approve(deployer.address, ethers.constants.MaxUint256);
  await alpacaFeederAsDeployer.feedGrassHouse();

  console.log(
    `Alpaca amount at AlpacaGrassHouse(After feed)`,
    await alpacaTokenAsDeployer.balanceOf(ALPACA_GRASSHOUSE_ADDRESS)
  );
  console.log(
    `✅ Done feed Alpaca ${await alpacaTokenAsDeployer.balanceOf(ALPACA_GRASSHOUSE_ADDRESS)} to AlpacaGrassHouse`
  );
});
