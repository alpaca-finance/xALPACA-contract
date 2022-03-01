import { BigNumber, BigNumberish } from "ethers"
import { formatUnits } from "ethers/lib/utils"

export function formatBigNumber(n: BigNumberish, format: "hex" | "purehex" | "wei"): string {
  const bn = BigNumber.from(n)

  if (format === "hex") {
    return bn.toHexString()
  }
  if (format === "purehex") {
    return bn.toHexString().split("0x")[1]
  }
  if (format === "wei") {
    return bn.toString()
  }
  return formatUnits(bn, format)
}
