import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  ProxyToken,
  ProxyToken__factory,
  XALPACA,
  XALPACA__factory,
  GrassHouse,
  GrassHouse__factory,
  AlpacaFeeder,
  AlpacaFeeder__factory,
  AlpacaFeeder02__factory,
  AlpacaFeeder02,
} from "../../typechain";
import * as addresses from "../constants/bsc/addresses";
import * as ftmAddresses from "../constants/ftm/addresses";
import * as timeHelpers from "./time";

export const deployXAlpaca = async (signer: SignerWithAddress): Promise<XALPACA> => {
  const XAlpaca = (await ethers.getContractFactory("xALPACA", signer)) as XALPACA__factory;
  const xalpaca = (await upgrades.deployProxy(XAlpaca, [addresses.ALPACA])) as XALPACA;
  return xalpaca.deployed();
};

export const deployXAlpacaFTM = async (signer: SignerWithAddress): Promise<XALPACA> => {
  const XAlpaca = (await ethers.getContractFactory("xALPACA", signer)) as XALPACA__factory;
  const xalpaca = (await upgrades.deployProxy(XAlpaca, [ftmAddresses.ALPACA])) as XALPACA;
  return xalpaca.deployed();
};

export const deployProxyToken = async (signer: SignerWithAddress): Promise<ProxyToken> => {
  const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", signer)) as ProxyToken__factory;
  const proxyToken = (await upgrades.deployProxy(PROXY_TOKEN, [
    `proxyToken`,
    `proxyToken`,
    addresses.TIME_LOCK,
  ])) as ProxyToken;
  return proxyToken.deployed();
};

export const deployProxyTokenFTM = async (signer: SignerWithAddress): Promise<ProxyToken> => {
  const PROXY_TOKEN = (await ethers.getContractFactory("ProxyToken", signer)) as ProxyToken__factory;
  const proxyToken = (await upgrades.deployProxy(PROXY_TOKEN, [
    `proxyToken`,
    `proxyToken`,
    ftmAddresses.TIME_LOCK,
  ])) as ProxyToken;
  return proxyToken.deployed();
};

export const deployGrasshouse = async (signer: SignerWithAddress, xalpacaAddress: string): Promise<GrassHouse> => {
  const GrassHouse = (await ethers.getContractFactory("GrassHouse", signer)) as GrassHouse__factory;
  const grassHouse = (await upgrades.deployProxy(GrassHouse, [
    xalpacaAddress,
    await timeHelpers.latestTimestamp(),
    addresses.ALPACA,
    signer.address,
  ])) as GrassHouse;
  return grassHouse.deployed();
};

export const deployGrasshouseFTM = async (signer: SignerWithAddress, xalpacaAddress: string): Promise<GrassHouse> => {
  const GrassHouse = (await ethers.getContractFactory("GrassHouse", signer)) as GrassHouse__factory;
  const grassHouse = (await upgrades.deployProxy(GrassHouse, [
    xalpacaAddress,
    await timeHelpers.latestTimestamp(),
    ftmAddresses.ALPACA,
    signer.address,
  ])) as GrassHouse;
  return grassHouse.deployed();
};

export const deployAlpacaFeeder = async (
  signer: SignerWithAddress,
  proxyTokenAddress: string,
  poolId: BigNumber,
  grassHouseAddress: string
): Promise<AlpacaFeeder> => {
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder", signer)) as AlpacaFeeder__factory;
  const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
    addresses.ALPACA,
    proxyTokenAddress,
    addresses.FAIR_LAUNCH,
    poolId,
    grassHouseAddress,
  ])) as AlpacaFeeder;
  return alpacaFeeder.deployed();
};

export const deployAlpacaFeeder02 = async (
  signer: SignerWithAddress,
  proxyTokenAddress: string,
  poolId: BigNumber,
  grassHouseAddress: string
): Promise<AlpacaFeeder02> => {
  const AlpacaFeeder = (await ethers.getContractFactory("AlpacaFeeder02", signer)) as AlpacaFeeder02__factory;
  const alpacaFeeder = (await upgrades.deployProxy(AlpacaFeeder, [
    ftmAddresses.ALPACA,
    proxyTokenAddress,
    ftmAddresses.FAIR_LAUNCH,
    poolId,
    grassHouseAddress,
  ])) as AlpacaFeeder02;
  return alpacaFeeder.deployed();
};
