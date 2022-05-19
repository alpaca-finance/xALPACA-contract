import {
  Timelock,
  Timelock__factory,
} from "@alpaca-finance/alpaca-contract/typechain"
import { BigNumber, BigNumberish, ethers, Overrides } from "ethers"
import { TimelockEntity } from "../../../entities"

export class CompLike {
  private timelock: Timelock

  constructor(_timelockAddress: string, _signer: ethers.Signer) {
    this.timelock = Timelock__factory.connect(_timelockAddress, _signer)
  }

  async queueTransaction(
    info: string,
    target: string,
    value: string,
    signature: string,
    paramTypes: Array<string>,
    params: Array<any>,
    eta: BigNumberish,
    overrides?: Overrides,
  ): Promise<TimelockEntity.Transaction> {
    console.log(`> Queue tx for: ${info}`)
    const etaBN = BigNumber.from(eta)
    const queueTx = await this.timelock.queueTransaction(
      target,
      value,
      signature,
      ethers.utils.defaultAbiCoder.encode(paramTypes, params),
      eta,
      overrides,
    )
    await queueTx.wait()
    const paramTypesStr = paramTypes.map((p) => `'${p}'`)
    const paramsStr = params.map((p) => {
      if (Array.isArray(p)) {
        const vauleWithQuote = p.map((p) => {
          if (typeof p === "string") return `'${p}'`
          return JSON.stringify(p)
        })
        return `[${vauleWithQuote}]`
      }

      if (typeof p === "string") {
        return `'${p}'`
      }

      return p
    })

    const executionTx = `await timelock.executeTransaction('${target}', '${value}', '${signature}', ethers.utils.defaultAbiCoder.encode([${paramTypesStr}], [${paramsStr}]), '${eta}')`
    console.log(`> ⛓ Queued at: ${queueTx.hash}`)
    return {
      info: info,
      queuedAt: queueTx.hash,
      executedAt: "",
      executionTransaction: executionTx,
      target,
      value,
      signature,
      paramTypes,
      params,
      eta: etaBN.toString(),
    }
  }

  async executeTransaction(
    info: string,
    queuedAt: string,
    executionTx: string,
    target: string,
    value: string,
    signature: string,
    paramTypes: Array<string>,
    params: Array<any>,
    eta: BigNumberish,
    overrides?: Overrides,
  ): Promise<TimelockEntity.Transaction> {
    console.log(`> Execute tx for: ${info}`)
    const etaBN = BigNumber.from(eta)
    const timelock = this.timelock
    const executeTx = await timelock.executeTransaction(
      target,
      value,
      signature,
      ethers.utils.defaultAbiCoder.encode(paramTypes, params),
      etaBN,
      overrides,
    )
    console.log("> ⛓ Executed at:", executeTx.hash)
    console.log(`> Done.`)

    return {
      info: info,
      queuedAt: queuedAt,
      executedAt: executeTx.hash,
      executionTransaction: executionTx,
      target,
      value,
      signature,
      paramTypes,
      params,
      eta: etaBN.toString(),
    }
  }
}
