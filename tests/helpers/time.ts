import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";

const HOUR = ethers.BigNumber.from(3600);
const DAY = ethers.BigNumber.from(86400);
const WEEK = DAY.mul(7);
const YEAR = DAY.mul(365);

export function timestampFloorWeek(t: BigNumberish): BigNumber {
  const bt = BigNumber.from(t);
  return bt.div(WEEK).mul(WEEK);
}

export async function latestTimestamp(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock("latest");
  return ethers.BigNumber.from(block.timestamp);
}

export async function latestBlockNumber(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock("latest");
  return ethers.BigNumber.from(block.number);
}

export async function advanceBlock() {
  await ethers.provider.send("evm_mine", []);
}

export async function setTimestamp(timeStamp: BigNumber) {
  await ethers.provider.send("evm_mine", [timeStamp.toNumber()]);
}

export async function increaseTimestamp(duration: BigNumber) {
  if (duration.isNegative()) throw Error(`Cannot increase time by a negative amount (${duration})`);

  await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);

  await advanceBlock();
}

export const duration = {
  seconds: function (val: BigNumber): BigNumber {
    return val;
  },
  minutes: function (val: BigNumber): BigNumber {
    return val.mul(this.seconds(ethers.BigNumber.from("60")));
  },
  hours: function (val: BigNumber): BigNumber {
    return val.mul(this.minutes(ethers.BigNumber.from("60")));
  },
  days: function (val: BigNumber): BigNumber {
    return val.mul(this.hours(ethers.BigNumber.from("24")));
  },
  weeks: function (val: BigNumber): BigNumber {
    return val.mul(this.days(ethers.BigNumber.from("7")));
  },
  years: function (val: BigNumber): BigNumber {
    return val.mul(this.days(ethers.BigNumber.from("365")));
  },
};

export async function advanceBlockTo(block: number) {
  let latestBlock = (await latestBlockNumber()).toNumber();

  if (block <= latestBlock) {
    throw new Error("input block exceeds current block");
  }

  while (block > latestBlock) {
    await advanceBlock();
    latestBlock++;
  }
}
