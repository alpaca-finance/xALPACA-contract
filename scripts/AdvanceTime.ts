import { task, types } from "hardhat/config";

task("advanceTime", "Advance timestamp and blocks")
  .addOptionalParam("years", "Years to be advanced", 0, types.int)
  .addOptionalParam("weeks", "Weeks to be advanced", 0, types.int)
  .addOptionalParam("days", "Days to be advanced", 0, types.int)
  .addOptionalParam("hours", "Hours to be advanced", 0, types.int)
  .setAction(async ({ years, weeks, days, hours }, { ethers }) => {
    const SEC_PER_BLOCK = 3;
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

    const blockToAdvance = durationInSec.div(SEC_PER_BLOCK).toNumber();

    for (let i = 0; i < blockToAdvance; i++) {
      await ethers.provider.send("evm_mine", []);
      i++;
    }
  });
