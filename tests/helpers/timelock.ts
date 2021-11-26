import { FairLaunch, Timelock, Timelock__factory } from "@alpaca-finance/alpaca-contract/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, BigNumber } from "ethers";
import * as addresses from "../constants/addresses";
import * as timeHelper from "./time";

export class TimelockHelper {
  private timelock: Timelock;
  private fairlaunch: FairLaunch;

  constructor(timelock: Timelock, fairlaunch: FairLaunch) {
    this.timelock = timelock;
    this.fairlaunch = fairlaunch;
  }

  async addFairLaunchPool(allocPoint: number, stakeToken: string, withUpdate?: boolean): Promise<BigNumber> {
    const executeTime = (await timeHelper.latestTimestamp())
      .add(timeHelper.duration.days(BigNumber.from(2)))
      .toNumber();
    await this.timelock.queueTransaction(
      addresses.SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [allocPoint, stakeToken, !!withUpdate]),
      executeTime
    );

    await timeHelper.increaseTimestamp(timeHelper.duration.days(ethers.BigNumber.from(2)));
    await this.timelock.executeTransaction(
      addresses.SHIELD,
      "0",
      "addPool(uint256,address,bool)",
      ethers.utils.defaultAbiCoder.encode(["uint256", "address", "bool"], [allocPoint, stakeToken, !!withUpdate]),
      executeTime
    );
    const poolLength = await this.fairlaunch.poolLength();
    return poolLength.sub(BigNumber.from(1));
  }
}
