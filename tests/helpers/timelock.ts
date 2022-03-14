import { FairLaunch, Timelock, Timelock__factory, MiniFL } from "@alpaca-finance/alpaca-contract/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { zeroAddress } from "ethereumjs-util";
import { ethers, BigNumber } from "ethers";
import * as addresses from "../constants/bsc/addresses";
import * as ftmAddresses from "../constants/bsc/addresses";
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

// export class TimelockHelperFTM {
//   private timelock: Timelock;
//   private miniFL: MiniFL;

//   constructor(timelock: Timelock, miniFL: MiniFL) {
//     this.timelock = timelock;
//     this.miniFL = miniFL;
//   }

//   async addMiniFLPool(allocPoint: number, stakeToken: string, withUpdate?: boolean): Promise<BigNumber> {
//     const executeTime = (await timeHelper.latestTimestamp())
//       .add(timeHelper.duration.days(BigNumber.from(2)))
//       .toNumber();
//     await this.timelock.queueTransaction(
//       ftmAddresses.FAIR_LAUNCH,
//       "0",
//       "addPool(uint256,address,address,bool,bool)",
//       ethers.utils.defaultAbiCoder.encode(
//         ["uint256", "address", "address", "bool", "bool"],
//         [allocPoint, stakeToken, zeroAddress, false, !!withUpdate]
//       ),
//       executeTime
//     );

//     await timeHelper.increaseTimestamp(timeHelper.duration.days(ethers.BigNumber.from(2)));
//     await this.timelock.executeTransaction(
//       ftmAddresses.FAIR_LAUNCH,
//       "0",
//       "addPool(uint256,address,address,bool,bool)",
//       ethers.utils.defaultAbiCoder.encode(
//         ["uint256", "address", "address", "bool", "bool"],
//         [allocPoint, stakeToken, zeroAddress, false, !!withUpdate]
//       ),
//       executeTime
//     );
//     const poolLength = await this.miniFL.poolLength();
//     return poolLength.sub(BigNumber.from(1));
//   }
// }
