import { BigNumberish } from "ethers"

export type MultiSignProposeTransactionOptions = {
  nonce?: number
}

export interface MultiSigServiceInterface {
  getAddress(): string

  proposeTransaction(
    to: string,
    value: BigNumberish,
    data: string,
    opts?: MultiSignProposeTransactionOptions,
  ): Promise<string>
}
