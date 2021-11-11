import { ethers } from "ethers";

export function max(a: ethers.BigNumberish, b: ethers.BigNumberish): ethers.BigNumber {
  const aBigNumber = ethers.BigNumber.from(a);
  const bBigNumber = ethers.BigNumber.from(b);

  return aBigNumber.gte(bBigNumber) ? aBigNumber : bBigNumber;
}

export function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
