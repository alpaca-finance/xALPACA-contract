import { ethers } from "ethers";
import { assert } from "chai";

export function assertBigNumberClose(
  actual: ethers.BigNumberish,
  expected: ethers.BigNumberish,
  variance: ethers.BigNumberish = 10,
  reason: string = ""
) {
  const actualBigNumber = ethers.BigNumber.from(actual);
  const expectedBigNumber = ethers.BigNumber.from(expected);

  assert.ok(
    actualBigNumber.gte(expectedBigNumber.sub(variance)),
    `${reason}: actual is too small to be close with expected with variance ${variance}`
  );

  assert.ok(
    actualBigNumber.lte(expectedBigNumber.add(variance)),
    `${reason}: actual is too big to be close with expected with variance ${variance}`
  );
}

export function assertBigNumberClosePercent(
  a: ethers.BigNumberish,
  b: ethers.BigNumberish,
  variance: string = "0.02",
  reason: string = ""
) {
  const aBigNumber = ethers.BigNumber.from(a);
  const bBigNumber = ethers.BigNumber.from(b);
  const varianceBigNumber = ethers.utils.parseUnits(variance, 16);

  if (aBigNumber.eq(bBigNumber)) return;

  const diff = aBigNumber.sub(bBigNumber).abs().mul(ethers.constants.WeiPerEther).div(aBigNumber.add(bBigNumber));
  assert.ok(diff.lte(varianceBigNumber), `${reason}: diff exceeded ${variance}`);
}
